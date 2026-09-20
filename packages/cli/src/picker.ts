import prompts from "prompts";

export type LaunchChoice = "cli" | "web";

export async function pickInterface(): Promise<LaunchChoice> {
  const response = await prompts({
    type: "select",
    name: "choice",
    message: "How would you like to use SpeedTest?",
    choices: [
      { title: "CLI — run a test right here in the terminal", value: "cli" },
      { title: "Web Interface — open the local web app", value: "web" },
    ],
    initial: 0,
  });

  // Ctrl+C / no answer: default to CLI rather than hanging or crashing.
  return (response.choice as LaunchChoice) ?? "cli";
}
