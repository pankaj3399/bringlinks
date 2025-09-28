import chalk from "chalk";
import { validateEnv } from "../../config/validateEnv";

export default class Logging {
  private static isDevelopment = validateEnv.NODE_ENV === "development";

  public static log = (args: any) => {
    if (this.isDevelopment) this.info(args);
  };

  public static info = (args: any) => {
    if (this.isDevelopment) {
      console.log(
        chalk.blue(`[${new Date().toLocaleString()}] [INFO]`),
        typeof args === "string" ? chalk.blueBright(args) : args
      );
    }
  };

  public static warning = (args: any) => {
    if (this.isDevelopment) {
      console.log(
        chalk.yellow(`[${new Date().toLocaleString()}] [WARN]`),
        typeof args === "string" ? chalk.yellowBright(args) : args
      );
    }
  };

  public static error = (args: any) => {
    if (this.isDevelopment) {
      console.log(
        chalk.red(`[${new Date().toLocaleString()}] [ERROR]`),
        typeof args === "string" ? chalk.redBright(args) : args
      );
    }
  };
}
