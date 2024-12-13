declare module "applescript" {
  /**
   * Executes an AppleScript command or script.
   * @param script The AppleScript code to execute.
   * @param callback Callback invoked with the result or error.
   */
  export function execString(
    script: string,
    callback: (err: Error | null, result?: any) => void
  ): void;

  /**
   * Executes an AppleScript file.
   * @param filePath Path to the AppleScript file.
   * @param callback Callback invoked with the result or error.
   */
  export function execFile(
    filePath: string,
    callback: (err: Error | null, result?: any) => void
  ): void;
}
