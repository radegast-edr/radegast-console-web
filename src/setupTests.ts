import '@testing-library/jest-dom';
import { vi } from 'vitest';

Element.prototype.animate = vi.fn().mockReturnValue({
	finished: Promise.resolve(),
	cancel: vi.fn(),
	commitStyles: vi.fn()
});
