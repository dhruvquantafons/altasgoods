/** Request time for server components. A function so render code does not call the impure Date.now() directly. */
export const serverNow = () => Date.now();
