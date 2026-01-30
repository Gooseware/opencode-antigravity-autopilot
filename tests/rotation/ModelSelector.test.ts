import { ModelSelector } from '../../src/rotation/ModelSelector';
import { QuotaTracker } from '../../src/rotation/QuotaTracker';
import { ModelRotationStrategy } from '../../src/types';

describe('ModelSelector', () => {
    let quotaTracker: QuotaTracker;
    let strategy: ModelRotationStrategy;
    let selector: ModelSelector;

    beforeEach(() => {
        quotaTracker = new QuotaTracker(0.1); // 10% threshold
        strategy = {
            preferredModels: ['model-A', 'model-B', 'model-C'],
            fallbackModels: ['fallback-1'],
            quotaThreshold: 0.1
        };
        selector = new ModelSelector(quotaTracker, strategy);
    });

    test('should pick first model if it is the only one above threshold', () => {
        quotaTracker.updateQuota('model-A', { remainingFraction: 0.5 });
        quotaTracker.updateQuota('model-B', { remainingFraction: 0.05 });
        quotaTracker.updateQuota('model-C', { remainingFraction: 0.05 });

        expect(selector.selectModel()).toBe('model-A');
    });

    test('should rotate through models based on availability (highest quota)', () => {
        quotaTracker.updateQuota('model-A', { remainingFraction: 0.5 });
        quotaTracker.updateQuota('model-B', { remainingFraction: 0.8 });
        quotaTracker.updateQuota('model-C', { remainingFraction: 0.7 });

        // Currently this fails because it picks model-A (first in list)
        expect(selector.selectModel()).toBe('model-B'); 
    });

    test('should pick model-C if it has the highest quota', () => {
        quotaTracker.updateQuota('model-A', { remainingFraction: 0.5 });
        quotaTracker.updateQuota('model-B', { remainingFraction: 0.6 });
        quotaTracker.updateQuota('model-C', { remainingFraction: 0.9 });

        expect(selector.selectModel()).toBe('model-C');
    });

    test('should fallback to preferred order if quotas are equal', () => {
        quotaTracker.updateQuota('model-A', { remainingFraction: 0.5 });
        quotaTracker.updateQuota('model-B', { remainingFraction: 0.5 });
        quotaTracker.updateQuota('model-C', { remainingFraction: 0.5 });

        expect(selector.selectModel()).toBe('model-A');
    });
});
