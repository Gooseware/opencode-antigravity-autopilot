import { plugin } from '../src/plugin';
import { HardLimitDetector } from '../src/rotation/HardLimitDetector';
import { QuotaManager } from '../src/manager';
import { QuotaCacheUpdater } from '../src/quota/QuotaCacheUpdater';
import * as fs from 'fs';

jest.mock('../src/rotation/HardLimitDetector');
jest.mock('../src/manager');
jest.mock('../src/quota/QuotaCacheUpdater');
jest.mock('fs');

describe('Plugin Hooks', () => {
    let mockDetector: jest.Mocked<HardLimitDetector>;
    let mockManager: jest.Mocked<QuotaManager>;
    let mockCtx: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockDetector = new HardLimitDetector() as jest.Mocked<HardLimitDetector>;
        mockManager = new QuotaManager() as jest.Mocked<QuotaManager>;
        
        (HardLimitDetector as jest.Mock).mockReturnValue(mockDetector);
        (QuotaManager as jest.Mock).mockReturnValue(mockManager);
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        mockCtx = {
            client: {
                tui: {
                    showToast: jest.fn().mockResolvedValue(undefined)
                }
            }
        };
    });

    test('chat.message hook switches model when quota is low', async () => {
        const p = await plugin(mockCtx);
        const chatMessageHook = p['chat.message'];

        if (!chatMessageHook) {
            throw new Error('chat.message hook not found');
        }

        const input = {};
        const output = {
            message: {
                model: {
                    providerID: 'google',
                    modelID: 'antigravity-gemini-3-pro-high'
                }
            }
        };

        mockDetector.checkHardLimit.mockResolvedValue({
            isExhausted: false,
            shouldRotate: true,
            nextModel: 'antigravity-claude-sonnet-4-5',
            message: 'Model below threshold'
        });

        await chatMessageHook(input, output);

        expect(output.message.model.modelID).toBe('antigravity-claude-sonnet-4-5');
        expect(output.message.model.providerID).toBe('anthropic');
        expect(mockCtx.client.tui.showToast).toHaveBeenCalledWith(expect.objectContaining({
            body: expect.objectContaining({
                title: 'Automatic Model Switch',
                variant: 'warning'
            })
        }));
    });

    test('chat.message hook does not switch when quota is healthy', async () => {
        const p = await plugin(mockCtx);
        const chatMessageHook = p['chat.message'];

        if (!chatMessageHook) {
            throw new Error('chat.message hook not found');
        }

        const input = {};
        const output = {
            message: {
                model: {
                    providerID: 'google',
                    modelID: 'antigravity-gemini-3-pro-high'
                }
            }
        };

        mockDetector.checkHardLimit.mockResolvedValue({
            isExhausted: false,
            shouldRotate: false
        });

        await chatMessageHook(input, output);

        expect(output.message.model.modelID).toBe('antigravity-gemini-3-pro-high');
        expect(mockCtx.client.tui.showToast).not.toHaveBeenCalled();
    });
});
