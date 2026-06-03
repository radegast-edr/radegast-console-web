import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AgentSetupInstructions from './AgentSetupInstructions.svelte';

vi.mock('$lib/api', () => ({
	api: {
		getBackendUrl: () => 'http://localhost:8000/'
	}
}));

describe('AgentSetupInstructions Component', () => {
	it('does not render when token is empty', () => {
		const { container } = render(AgentSetupInstructions, { props: { token: '' } });
		expect(container.innerHTML).toBe('<!---->');
	});

	it('renders Device Created title when isReinstall is false', () => {
		render(AgentSetupInstructions, { props: { token: 'tok_123', isReinstall: false } });
		expect(screen.getByText('Device Created: Setup Agent')).toBeInTheDocument();
	});

	it('renders Device Reinstallation title when isReinstall is true', () => {
		render(AgentSetupInstructions, { props: { token: 'tok_123', isReinstall: true } });
		expect(screen.getByText('Device Reinstallation: Setup Agent')).toBeInTheDocument();
	});

	it('toggles OS setup commands correctly', async () => {
		render(AgentSetupInstructions, { props: { token: 'my_test_token' } });

		// Default should be Linux
		expect(screen.getByText(/curl -sSL "http:\/\/localhost:8000\/device\/install\?os=linux"/)).toBeInTheDocument();
		expect(screen.queryByText(/install\.bat/)).toBeNull();

		// Click Windows
		const winBtn = screen.getByText('Windows');
		await fireEvent.click(winBtn);
		expect(screen.getByText(/install\.bat/)).toBeInTheDocument();
		expect(screen.queryByText(/curl -sSL/)).toBeNull();

		// Click macOS
		const macBtn = screen.getByText('macOS');
		await fireEvent.click(macBtn);
		expect(screen.getByText('macOS Support is coming soon!')).toBeInTheDocument();
		expect(screen.getByText('my_test_token')).toBeInTheDocument();
	});

	it('calls onDismiss when Dismiss button is clicked', async () => {
		const onDismiss = vi.fn();
		render(AgentSetupInstructions, { props: { token: 'tok_123', onDismiss } });

		const dismissBtn = screen.getByText('Dismiss');
		await fireEvent.click(dismissBtn);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
