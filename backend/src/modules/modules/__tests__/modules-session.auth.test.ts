/**
 * Modules controller uses the authenticated session.
 * A missing session is 401. A body user id is not the acting user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The modules controller is Nest-shaped, and @nestjs/common is not installed
// in this package. Stub the decorators and HTTP exceptions so the session
// checks can be exercised without booting Nest.
vi.mock('@nestjs/common', () => {
  class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
    getStatus(): number {
      return this.status;
    }
  }
  const passthrough = () => () => undefined;
  return {
    Controller: () => (target: unknown) => target,
    Get: passthrough,
    Patch: passthrough,
    Post: passthrough,
    Param: passthrough,
    Body: passthrough,
    Req: passthrough,
    UnauthorizedException: class UnauthorizedException extends HttpError {
      constructor(message = 'Unauthorized') {
        super(401, message);
      }
    },
    NotFoundException: class NotFoundException extends HttpError {
      constructor(message = 'Not Found') {
        super(404, message);
      }
    },
  };
});

vi.mock('../modules.service', () => ({
  ModulesService: class ModulesService {},
}));

import { UnauthorizedException, NotFoundException } from '@nestjs/common';

import { ModulesController } from '../modules.controller';

const OWNER = '11111111-1111-4111-8111-111111111111';
const SPOOF = '22222222-2222-4222-8222-222222222222';

function serviceDouble() {
  return {
    getModules: vi.fn(async () => ({ categories: [], userBundle: null })),
    toggleModule: vi.fn(async () => ({
      moduleSlug: 'supply',
      enabled: true,
      subscribed: false,
      bundleId: null,
      activatedAt: null,
    })),
    getEnabledModules: vi.fn(async () => ['supply']),
    subscribeModule: vi.fn(),
  };
}

describe('modules controller session identity', () => {
  let service: ReturnType<typeof serviceDouble>;
  let controller: ModulesController;

  beforeEach(() => {
    service = serviceDouble();
    controller = new ModulesController(service as never);
  });

  it('rejects an unauthenticated module list', async () => {
    await expect(controller.getModules({ user: undefined, body: { userId: 'demo-user' } }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.getModules).not.toHaveBeenCalled();
  });

  it('lists modules for the session user and ignores a body user id', async () => {
    const result = await controller.getModules({
      user: { userId: OWNER },
      body: { userId: SPOOF, id: 'demo-user' },
    });

    expect(result.categories).toEqual([]);
    expect(service.getModules).toHaveBeenCalledWith(OWNER);
  });

  it('accepts the legacy session id field and still ignores the body', async () => {
    await controller.getEnabledModules({
      user: { id: OWNER },
      body: { userId: 'demo-user' },
    });
    expect(service.getEnabledModules).toHaveBeenCalledWith(OWNER);
  });

  it('returns 404 when the module to toggle does not exist', async () => {
    service.toggleModule.mockRejectedValue(new Error('Module not found'));
    await expect(controller.toggleModule('missing', { enabled: true } as never, { user: { userId: OWNER } }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(service.toggleModule).toHaveBeenCalledWith(OWNER, 'missing', true);
  });

  it('rejects an unauthenticated purchase before logging a demo user', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(controller.purchaseModule('supply', {} as never, { body: { userId: 'demo-user' } }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('purchases as the session user', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await controller.purchaseModule('supply', {} as never, {
      user: { userId: OWNER },
      body: { userId: SPOOF },
    });
    expect(result.success).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(OWNER));
    expect(log.mock.calls.some((call) => String(call[0]).includes(SPOOF))).toBe(false);
    expect(log.mock.calls.some((call) => String(call[0]).includes('demo-user'))).toBe(false);
    log.mockRestore();
  });
});
