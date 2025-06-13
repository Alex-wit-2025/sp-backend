// secrets parser/provider
import * as dotenv from "dotenv";
import * as path from "path";

export class Secrets {
  private static loaded = false;

  static loadEnv(): void {
    if (!this.loaded) {
      dotenv.config({ path: path.resolve(__dirname, "../../.env") });
      this.loaded = true;
    }
  }

  static get(key: string): string {
    this.loadEnv();

    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
  }

  // Optional: typed getters
  static get secretKey(): string {
    return this.get("SECRET_KEY");
  }

  static get apiUrl(): string {
    return this.get("API_URL");
  }
}
