import { writable } from 'svelte/store';

export const confirmState = writable({
    show: false,
    message: '',
    resolve: null as ((val: boolean) => void) | null
});

export function askConfirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
        confirmState.set({ show: true, message, resolve });
    });
}
