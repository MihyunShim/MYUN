import AVFoundation
import Capacitor
import Foundation
import UIKit

/// Generates a notification sound while the app is open. iOS, not this plugin,
/// plays the completed file when a scheduled notification is delivered.
@objc(CareVoicePlugin)
public final class CareVoicePlugin: CAPPlugin, CAPBridgedPlugin, AVAudioPlayerDelegate {
    public let identifier = "CareVoicePlugin"
    public let jsName = "CareVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preview", returnType: CAPPluginReturnPromise)
    ]

    private let soundName = "denture-care-ko-v1.caf"
    // All mutable state and audio writes are serialized on the main queue.
    private var waitingCalls: [CAPPluginCall] = []
    private var generation: UUID?
    private var synthesizer: AVSpeechSynthesizer?
    private var audioFile: AVAudioFile?
    private var temporaryURL: URL?
    private var destinationURL: URL?
    private var timeout: DispatchWorkItem?

    private var player: AVAudioPlayer?
    private var previewCalls: [CAPPluginCall] = []
    private var inactiveObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var previewTimeout: DispatchWorkItem?

    public override func load() {
        inactiveObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            self?.finishPreview(error: "앱을 벗어나 음성 미리듣기를 중지했어요.", code: "PREVIEW_INTERRUPTED")
        }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] notification in
            guard let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  type == AVAudioSession.InterruptionType.began.rawValue else { return }
            self?.finishPreview(error: "다른 오디오 작업으로 미리듣기가 중단됐어요.", code: "PREVIEW_INTERRUPTED")
        }
    }

    deinit {
        if let observer = inactiveObserver { NotificationCenter.default.removeObserver(observer) }
        if let observer = interruptionObserver { NotificationCenter.default.removeObserver(observer) }
    }

    private func soundURL(create: Bool = false) throws -> URL {
        let library = try FileManager.default.url(for: .libraryDirectory,
            in: .userDomainMask, appropriateFor: nil, create: create)
        let directory = library.appendingPathComponent("Sounds", isDirectory: true)
        if create {
            try FileManager.default.createDirectory(at: directory,
                withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        }
        return directory.appendingPathComponent(soundName)
    }

    @objc public func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.generation != nil {
                call.resolve(["ready": false, "reason": "PREPARING"])
                return
            }
            guard let url = try? self.soundURL() else {
                call.resolve(["ready": false, "reason": "MISSING_FILE"])
                return
            }
            call.resolve(self.inspectSound(url))
        }
    }

    @objc public func preview(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard UIApplication.shared.applicationState == .active else {
                call.reject("앱을 열어둔 상태에서 미리듣기를 실행해주세요.", "PREVIEW_INTERRUPTED")
                return
            }
            if self.player != nil {
                self.previewCalls.append(call)
                return
            }
            guard self.generation == nil, let url = try? self.soundURL(), self.isValidSound(url) else {
                call.reject("음성 파일을 먼저 준비해주세요.", "VOICE_NOT_READY")
                return
            }
            self.previewCalls = [call]
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [.duckOthers])
                try session.setActive(true)
                let player = try AVAudioPlayer(contentsOf: url)
                self.player = player
                player.delegate = self
                player.volume = 1
                guard player.prepareToPlay(), player.play() else {
                    self.finishPreview(error: "음성을 재생하지 못했어요.", code: "PREVIEW_FAILED")
                    return
                }
                let deadline = DispatchWorkItem { [weak self, weak player] in
                    guard let self = self, let player = player, self.player === player else { return }
                    self.finishPreview(error: "음성 재생이 완료되지 않았어요. 다시 시도해주세요.", code: "PREVIEW_FAILED")
                }
                self.previewTimeout = deadline
                DispatchQueue.main.asyncAfter(deadline: .now() + 35, execute: deadline)
            } catch {
                self.finishPreview(error: "음성을 재생하지 못했어요.", code: "PREVIEW_FAILED")
            }
        }
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.player === player else { return }
            self.finishPreview(error: flag ? nil : "음성 재생이 중단됐어요.", code: "PREVIEW_FAILED")
        }
    }

    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.player === player else { return }
            self.finishPreview(error: "음성 파일을 재생하지 못했어요.", code: "PREVIEW_FAILED")
        }
    }

    private func finishPreview(error: String?, code: String) {
        guard !previewCalls.isEmpty || player != nil else { return }
        previewTimeout?.cancel()
        previewTimeout = nil
        player?.delegate = nil
        player?.stop()
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        let calls = previewCalls
        previewCalls = []
        calls.forEach { call in
            if let error = error { call.reject(error, code) }
            else { call.resolve(["played": true]) }
        }
    }

    @objc public func prepare(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.prepareOnMain(call)
        }
    }

    private func prepareOnMain(_ call: CAPPluginCall) {
        if generation != nil {
            waitingCalls.append(call)
            return
        }
        finishPreview(error: "음성 파일을 준비하기 위해 미리듣기를 중지했어요.", code: "PREVIEW_INTERRUPTED")
        waitingCalls = [call]
        do {
            let destination = try soundURL(create: true)
            let directory = destination.deletingLastPathComponent()
            if !call.getBool("force", false), isValidSound(destination) {
                resolveAll()
                return
            }
            guard let voice = AVSpeechSynthesisVoice(language: "ko-KR"),
                  voice.language.lowercased().hasPrefix("ko") else {
                rejectAll("한국어 음성을 사용할 수 없어요. 아이폰의 한국어 음성 설정을 확인해주세요.",
                    code: "VOICE_UNAVAILABLE")
                return
            }
            let token = UUID()
            generation = token
            destinationURL = destination
            temporaryURL = directory.appendingPathComponent(".care-voice-\(token.uuidString).caf")
            let utterance = AVSpeechUtterance(string: "틀니를 세척할 시간입니다")
            utterance.voice = voice
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
            let speech = AVSpeechSynthesizer()
            synthesizer = speech
            let deadline = DispatchWorkItem { [weak self] in
                guard let self = self, self.generation == token else { return }
                self.rejectAll("음성 준비 시간이 초과됐어요. 앱을 열어둔 상태에서 다시 시도해주세요.",
                    code: "VOICE_TIMEOUT")
            }
            timeout = deadline
            DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: deadline)
            speech.write(utterance) { [weak self] buffer in
                // Copy while AVFoundation owns the callback buffer, then enqueue.
                // Never synchronously wait on main from a synthesis callback.
                guard let pcm = buffer as? AVAudioPCMBuffer else {
                    DispatchQueue.main.async { [weak self] in
                        guard let self = self, self.generation == token else { return }
                        self.rejectAll("음성 데이터를 읽지 못했어요.", code: "VOICE_INVALID_AUDIO")
                    }
                    return
                }
                if pcm.frameLength == 0 {
                    DispatchQueue.main.async { [weak self] in
                        guard let self = self, self.generation == token else { return }
                        self.completeGeneration()
                    }
                    return
                }
                let owned = Self.copyPCM(pcm)
                DispatchQueue.main.async { [weak self] in
                    guard let self = self, self.generation == token else { return }
                    guard let owned = owned else {
                        self.rejectAll("음성 데이터를 읽지 못했어요.", code: "VOICE_INVALID_AUDIO")
                        return
                    }
                    self.consume(owned)
                }
            }
        } catch {
            rejectAll("음성 알림 파일을 저장하지 못했어요. 다시 시도해주세요.", code: "VOICE_WRITE_FAILED")
        }
    }

    private static func copyPCM(_ source: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let copy = AVAudioPCMBuffer(pcmFormat: source.format, frameCapacity: source.frameLength) else {
            return nil
        }
        copy.frameLength = source.frameLength
        let sourceBuffers = UnsafeMutableAudioBufferListPointer(source.mutableAudioBufferList)
        let destinationBuffers = UnsafeMutableAudioBufferListPointer(copy.mutableAudioBufferList)
        guard sourceBuffers.count == destinationBuffers.count else { return nil }
        for index in 0..<sourceBuffers.count {
            let byteCount = Int(sourceBuffers[index].mDataByteSize)
            guard byteCount > 0, byteCount <= Int(destinationBuffers[index].mDataByteSize),
                  let from = sourceBuffers[index].mData, let to = destinationBuffers[index].mData else { return nil }
            to.copyMemory(from: from, byteCount: byteCount)
            destinationBuffers[index].mDataByteSize = UInt32(byteCount)
        }
        return copy
    }

    private func consume(_ buffer: AVAudioBuffer) {
        guard let pcm = buffer as? AVAudioPCMBuffer else {
            rejectAll("음성 데이터를 읽지 못했어요.", code: "VOICE_INVALID_AUDIO")
            return
        }
        if pcm.frameLength == 0 {
            completeGeneration()
            return
        }
        guard pcm.format.sampleRate > 0, pcm.format.channelCount > 0,
              let url = temporaryURL else {
            rejectAll("음성 데이터 형식이 올바르지 않아요.", code: "VOICE_INVALID_AUDIO")
            return
        }
        do {
            if audioFile == nil {
                // CAF with 16-bit linear PCM is supported by notification sounds.
                let settings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatLinearPCM,
                    AVSampleRateKey: pcm.format.sampleRate,
                    AVNumberOfChannelsKey: pcm.format.channelCount,
                    AVLinearPCMBitDepthKey: 16,
                    AVLinearPCMIsFloatKey: false,
                    AVLinearPCMIsBigEndianKey: false,
                    AVLinearPCMIsNonInterleaved: false
                ]
                audioFile = try AVAudioFile(forWriting: url, settings: settings,
                    commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved)
            }
            guard let file = audioFile else { return }
            let seconds = Double(file.length + AVAudioFramePosition(pcm.frameLength)) / pcm.format.sampleRate
            guard seconds < 30 else {
                rejectAll("음성 알림은 30초 미만이어야 해요.", code: "VOICE_INVALID_AUDIO")
                return
            }
            try file.write(from: pcm)
        } catch {
            rejectAll("음성 알림 파일을 만들지 못했어요. 다시 시도해주세요.", code: "VOICE_WRITE_FAILED")
        }
    }

    private func inspectSound(_ url: URL) -> [String: Any] {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return ["ready": false, "reason": "MISSING_FILE"]
        }
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let bytes = attributes[.size] as? NSNumber,
              let file = try? AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: false),
              file.fileFormat.streamDescription.pointee.mFormatID == kAudioFormatLinearPCM,
              file.fileFormat.streamDescription.pointee.mBitsPerChannel == 16,
              file.fileFormat.sampleRate > 0, file.fileFormat.channelCount > 0 else {
            return ["ready": false, "reason": "INVALID_FORMAT"]
        }
        let duration = Double(file.length) / file.fileFormat.sampleRate
        guard duration.isFinite, duration >= 0.5, duration < 30 else {
            return ["ready": false, "reason": "INVALID_DURATION"]
        }
        // A valid header alone does not prove that synthesis produced speech.
        // Decode the entire short notification file, rejecting silence/truncation.
        guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 4096) else {
            return ["ready": false, "reason": "INVALID_AUDIO"]
        }
        var peak: Float = 0
        do {
            while file.framePosition < file.length {
                try file.read(into: buffer, frameCount: 4096)
                guard buffer.frameLength > 0, let channels = buffer.floatChannelData else {
                    return ["ready": false, "reason": "INVALID_AUDIO"]
                }
                for channel in 0..<Int(buffer.format.channelCount) {
                    for frame in 0..<Int(buffer.frameLength) {
                        let sample = channels[channel][frame]
                        guard sample.isFinite else { return ["ready": false, "reason": "INVALID_AUDIO"] }
                        peak = max(peak, abs(sample))
                    }
                }
            }
        } catch {
            return ["ready": false, "reason": "INVALID_AUDIO"]
        }
        guard peak > 0.001 else { return ["ready": false, "reason": "SILENT_AUDIO"] }
        return ["ready": true, "durationSeconds": duration, "bytes": bytes]
    }

    private func isValidSound(_ url: URL) -> Bool {
        return inspectSound(url)["ready"] as? Bool == true
    }

    private func completeGeneration() {
        // Release the writer to flush/finalize the CAF header before validation.
        audioFile = nil
        guard let temporary = temporaryURL, let destination = destinationURL,
              isValidSound(temporary) else {
            rejectAll("완성된 음성 파일을 확인하지 못했어요. 다시 시도해주세요.", code: "VOICE_INVALID_AUDIO")
            return
        }
        do {
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: temporary.path)
            // Publish only a validated complete sound; explicit repair may replace a
            // valid older cache. Keep the older sound if generation fails.
            if FileManager.default.fileExists(atPath: destination.path) {
                _ = try FileManager.default.replaceItemAt(destination, withItemAt: temporary)
            } else {
                try FileManager.default.moveItem(at: temporary, to: destination)
            }
            temporaryURL = nil
            resolveAll()
        } catch {
            rejectAll("음성 알림 파일을 저장하지 못했어요.", code: "VOICE_WRITE_FAILED")
        }
    }

    private func clearGeneration() {
        generation = nil // Ignore callbacks from a cancelled or completed generation.
        timeout?.cancel()
        timeout = nil
        audioFile = nil
        let speech = synthesizer
        synthesizer = nil
        // Never stop synchronously inside a speech buffer callback: the speech
        // engine may be waiting for that callback to return.
        if let speech = speech {
            DispatchQueue.main.async { speech.stopSpeaking(at: .immediate) }
        }
        if let url = temporaryURL { try? FileManager.default.removeItem(at: url) }
        temporaryURL = nil
        destinationURL = nil
    }

    private func resolveAll() {
        let calls = waitingCalls
        waitingCalls = []
        clearGeneration()
        calls.forEach { $0.resolve(["sound": soundName]) }
    }

    private func rejectAll(_ message: String, code: String) {
        let calls = waitingCalls
        waitingCalls = []
        clearGeneration()
        calls.forEach { $0.reject(message, code) }
    }
}
