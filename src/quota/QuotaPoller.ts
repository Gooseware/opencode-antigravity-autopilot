import axios from 'axios';

export interface QuotaInfo {
    remainingFraction: number;
    resetTime?: string;
    model?: string;
}

export class QuotaPoller {
    constructor() {
        if (!(this instanceof QuotaPoller)) {
            // @ts-ignore
            return new QuotaPoller();
        }
    }
    async checkQuota(port: number, csrfToken: string): Promise<QuotaInfo | null> {
        try {
            const url = `http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
            const response = await axios.post(url,
                { ideName: "antigravity", ideVersion: "unknown" },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Codeium-Csrf-Token': csrfToken
                    }
                }
            );

            const quotaInfo = response.data?.clientModelConfigs?.quotaInfo;
            if (!quotaInfo) {
                return null;
            }

            return {
                remainingFraction: quotaInfo.remainingFraction,
                resetTime: quotaInfo.resetTime
            };
        } catch (error) {
            return null;
        }
    }
}
