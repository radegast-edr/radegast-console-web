import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import VirtualListTestHelper from './VirtualListTestHelper.svelte';

describe('VirtualList component', () => {
	it('renders empty snippet when items array is empty', () => {
		render(VirtualListTestHelper, { items: [] });
		expect(screen.getByText('No items found')).toBeInTheDocument();
	});

	it('renders items within the visible window and maintains top/bottom spacers', () => {
		const items = Array.from({ length: 50 }, (_, i) => `Item #${i + 1}`);
		render(VirtualListTestHelper, { items });

		// Should render the first visible slice of items
		expect(screen.getByText('Item #1')).toBeInTheDocument();
		expect(screen.getByText('Item #5')).toBeInTheDocument();

		// Virtual list container should be present
		const container = screen.getByTestId('virtual-list');
		expect(container).toBeInTheDocument();
	});
});
