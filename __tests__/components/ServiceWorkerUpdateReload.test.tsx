import { render } from '@testing-library/react'
import { ServiceWorkerUpdateReload } from '@/components/ServiceWorkerUpdateReload'

function mockServiceWorker() {
  const listeners: Record<string, EventListener[]> = {}
  const sw = {
    addEventListener: (type: string, fn: EventListener) => {
      listeners[type] = listeners[type] ?? []
      listeners[type].push(fn)
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter(f => f !== fn)
    },
  }
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true })
  return {
    fire: (type: string) => listeners[type]?.forEach(fn => fn(new Event(type))),
    listenerCount: (type: string) => listeners[type]?.length ?? 0,
  }
}

describe('ServiceWorkerUpdateReload', () => {
  it('does nothing if serviceWorker is unsupported', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
    const reload = jest.fn()
    render(<ServiceWorkerUpdateReload reload={reload} />)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once a new service worker takes control', () => {
    const sw = mockServiceWorker()
    const reload = jest.fn()
    render(<ServiceWorkerUpdateReload reload={reload} />)
    sw.fire('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('only reloads once even if controllerchange fires again', () => {
    const sw = mockServiceWorker()
    const reload = jest.fn()
    render(<ServiceWorkerUpdateReload reload={reload} />)
    sw.fire('controllerchange')
    sw.fire('controllerchange')
    sw.fire('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('removes its listener on unmount', () => {
    const sw = mockServiceWorker()
    const { unmount } = render(<ServiceWorkerUpdateReload reload={jest.fn()} />)
    expect(sw.listenerCount('controllerchange')).toBe(1)
    unmount()
    expect(sw.listenerCount('controllerchange')).toBe(0)
  })
})
