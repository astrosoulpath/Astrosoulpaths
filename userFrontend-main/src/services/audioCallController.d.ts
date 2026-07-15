export declare const audioCallController: {
  initialize(): Promise<boolean>;
  startCall(): Promise<void>;
  endCall(): Promise<void>;
  toggleMicrophone(): Promise<void>;
};