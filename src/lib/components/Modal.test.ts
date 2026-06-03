import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ModalTestHelper from './ModalTestHelper.svelte';

describe('Modal Component', () => {
	it('does not render when show is false', () => {
		const { container } = render(ModalTestHelper, { props: { show: false } });
		expect(container.innerHTML).toBe('<!---->');
		expect(screen.queryByTestId('modal-content')).toBeNull();
	});

	it('renders title and child content when show is true', () => {
		render(ModalTestHelper, { props: { show: true, title: 'Hello Modal' } });
		expect(screen.getByText('Hello Modal')).toBeInTheDocument();
		expect(screen.getByTestId('modal-content')).toBeInTheDocument();
		expect(screen.getByText('Modal Child Content')).toBeInTheDocument();
	});

	it('triggers onClose when close button is clicked', async () => {
		const onClose = vi.fn();
		render(ModalTestHelper, { props: { show: true, onClose } });

		const closeBtn = screen.getByLabelText('Close');
		await fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('triggers onClose when backdrop is clicked', async () => {
		const onClose = vi.fn();
		const { container } = render(ModalTestHelper, { props: { show: true, onClose } });

		const backdrop = container.querySelector('.modal-backdrop');
		expect(backdrop).not.toBeNull();
		if (backdrop) {
			await fireEvent.click(backdrop);
		}
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
