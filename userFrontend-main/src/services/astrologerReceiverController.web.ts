class AstrologerReceiverController {
  async initialize() {
    console.warn(
      "[WEB] Astrologer receiver is not supported on Web.",
    );

    return false;
  }

  async endCall() {
    return;
  }

  async toggleMicrophone() {
    return;
  }
}

export const astrologerReceiverController =
  new AstrologerReceiverController();