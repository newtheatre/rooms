/**
 * The one shape for a failed request: an API message when there is one, the
 * caller's fallback when there is not.
 */

export function useErrorToast() {
  const toast = useToast()

  return function showError(error: unknown, fallback: string) {
    const detail = error as { data?: { message?: string }, statusMessage?: string }

    toast.add({
      title: 'Error',
      description: detail?.data?.message || detail?.statusMessage || fallback,
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}
