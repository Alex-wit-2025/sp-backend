//mongodb provider
import { MongoClient } from "mongodb";
import { Secrets } from "../utils/secrets";

export class MongoDBProvider {
  private static uri = "";
  private static loaded = false;
  private static client: MongoClient;

  async MongoDBProvider() {
    if (!MongoDBProvider.loaded) {
      await this.constructURIMakeClient();
    }
  }

  private async constructURIMakeClient() {
    let mongoUser = Secrets.get("MONGO_USER");
    let mongoPass = Secrets.get("MONGO_PASS");
    let mongoPort = Secrets.get("MONGO_PORT");
    MongoDBProvider.uri = `mongodb://${mongoUser}:${mongoPass}@mongo:${mongoPort}/`;

    MongoDBProvider.client = new MongoClient(MongoDBProvider.uri);
    await MongoDBProvider.client.connect();
  }

  public getConnection(database: string) {
    return MongoDBProvider.client.db(database);
  }
}
