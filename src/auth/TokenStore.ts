import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class TokenStore {
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.config', 'opencode', 'antigravity-accounts.json');
  }

  saveTokens(tokens: any[]): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  }

  loadTokens(): any[] {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }
    const data = fs.readFileSync(this.configPath, 'utf8');
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
}
