import { ApiError, NetworkError, toUserMessage } from '../apiError';

describe('ApiError', () => {
  it('survives instanceof after transpilation', () => {
    const error = new ApiError(404, 'Not found', null);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
  });

  it('flattens sub-errors into a field lookup', () => {
    const error = new ApiError(400, 'Validation failed', {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      path: '/api/auth/register',
      timestamp: '2026-08-24T00:00:00Z',
      errors: [
        { field: 'email', message: 'already registered' },
        { field: 'password', message: 'too short' },
      ],
    });

    expect(error.fieldErrors()).toEqual({ email: 'already registered', password: 'too short' });
  });

  it('drops sub-errors that name no field — they have nowhere to render', () => {
    const error = new ApiError(400, 'Validation failed', {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      path: '/api/orders',
      timestamp: '2026-08-24T00:00:00Z',
      errors: [{ field: null, message: 'the cart is empty' }],
    });

    expect(error.fieldErrors()).toEqual({});
  });

  it('returns an empty lookup when there is no body at all', () => {
    expect(new ApiError(500, 'Boom', null).fieldErrors()).toEqual({});
  });
});

describe('toUserMessage', () => {
  it('uses the API message', () => {
    expect(toUserMessage(new ApiError(409, 'Email already registered', null))).toBe(
      'Email already registered',
    );
  });

  it('uses the network message', () => {
    expect(toUserMessage(new NetworkError('Check your connection.'))).toBe(
      'Check your connection.',
    );
  });

  it('falls back for a message-less Error', () => {
    expect(toUserMessage(new Error(''), 'Could not load the menu.')).toBe(
      'Could not load the menu.',
    );
  });

  it('falls back for a thrown non-Error', () => {
    expect(toUserMessage('a string', 'Could not load the menu.')).toBe('Could not load the menu.');
  });
});
