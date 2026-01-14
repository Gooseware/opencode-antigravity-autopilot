import { QuotaPoller } from '../../src/quota/QuotaPoller';
import axios from 'axios';

jest.mock('axios');

describe('QuotaPoller', () => {
  it('should parse quota from response', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
        data: { 
            clientModelConfigs: { 
                quotaInfo: { 
                    remainingFraction: 0.8, 
                    resetTime: '2023-01-01' 
                } 
            } 
        }
    });

    const poller = new QuotaPoller();
    const quota = await poller.checkQuota(1234, 'test-token');

    expect(quota).toEqual({
        remainingFraction: 0.8,
        resetTime: '2023-01-01'
    });
    
    expect(axios.post).toHaveBeenCalledWith(
        'http://127.0.0.1:1234/exa.language_server_pb.LanguageServerService/GetUserStatus',
        { ideName: "antigravity", ideVersion: "unknown" },
        {
            headers: {
                'Content-Type': 'application/json',
                'X-Codeium-Csrf-Token': 'test-token'
            }
        }
    );
  });

  it('should handle errors gracefully', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const poller = new QuotaPoller();
      const quota = await poller.checkQuota(1234, 'test-token');
      
      expect(quota).toBeNull();
  });

  it('should return null if response structure is invalid', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
        data: {}
    });

    const poller = new QuotaPoller();
    const quota = await poller.checkQuota(1234, 'test-token');

    expect(quota).toBeNull();
  });
});
