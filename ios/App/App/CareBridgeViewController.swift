import Capacitor

final class CareBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CareVoicePlugin())
    }
}
