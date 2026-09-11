import AVFoundation
import Capacitor
import Foundation

/// Generates a notification sound while the app is open. iOS, not this plugin,
/// plays the completed file when a scheduled notification is delivered.
@objc(CareVoicePlugin)
public final class CareVoicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CareVoicePlugin"
    public let jsName = "CareVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise)
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
        waitingCalls = [call]
        do {
            let library = try FileManager.default.url(for: .libraryDirectory,
                in: .userDomainMask, appropriateFor: nil, create: true)
            let directory = library.appendingPathComponent("Sounds", isDirectory: true)
            try FileManager.default.createDirectory(at: directory,
                withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            let destination = directory.appendingPathComponent(soundName)
            if isValidSound(destination) {
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
                // Consume the callback buffer before returning it to AVFoundation;
                // do not enqueue a borrowed buffer whose storage may be reused.
                let consume = { [weak self] in
                    guard let self = self, self.generation == token else { return }
                    self.consume(buffer)
                }
                if Thread.isMainThread { consume() } else { DispatchQueue.main.sync(execute: consume) }
            }
        } catch {
            rejectAll("음성 알림 파일을 저장하지 못했어요. 다시 시도해주세요.", code: "VOICE_WRITE_FAILED")
        }
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

    private func isValidSound(_ url: URL) -> Bool {
        guard let file = try? AVAudioFile(forReading: url), file.length > 0,
              file.fileFormat.streamDescription.pointee.mFormatID == kAudioFormatLinearPCM,
              file.fileFormat.sampleRate > 0 else { return false }
        let duration = Double(file.length) / file.fileFormat.sampleRate
        return duration >= 0.5 && duration < 30
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
            // A same-directory move publishes only a complete sound. Invalid older
            // cache files are discarded; a valid cache is never regenerated.
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: temporary, to: destination)
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
