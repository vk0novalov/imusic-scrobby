declare module "applescript" {
  /**
   * Executes an AppleScript command or script.
   * @param script The AppleScript code to execute.
   * @param callback Callback invoked with the result or error.
   */
  export function execString<T>(
    script: string,
    callback: (err: Error | null, result?: T) => void
  ): void;

  /**
   * Executes an AppleScript file.
   * @param filePath Path to the AppleScript file.
   * @param callback Callback invoked with the result or error.
   */
  export function execFile<T>(
    filePath: string,
    callback: (err: Error | null, result?: T) => void
  ): void;
}
