import { act } from 'react';
import { createRoot } from 'react-dom/client';
import Wishlist from './pages/Wishlist';
import MovieActions from './components/MovieActions';
import Register from './pages/Register';
import MovieDetail from './pages/MovieDetail';
import { useAuth } from './auth/AuthContext';
import { getWishlist, putVote, addToWishlist, removeFromWishlist, getMovie, getReviews, postReview } from './api/backend';

jest.mock('./auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./api/backend', () => ({
  getWishlist: jest.fn(), putVote: jest.fn(),
  addToWishlist: jest.fn(), removeFromWishlist: jest.fn(),
  getMovie: jest.fn(), getReviews: jest.fn(), postReview: jest.fn(),
}));
jest.mock('./components/MovieGrid', () => function Grid({ movies, status, error, onRetry }) {
  return <div>{status}{error?.message}{movies.map(m => m.title).join(',')}
    <button onClick={onRetry}>retry</button></div>;
});
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Link: ({ children }) => <span>{children}</span>,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '42' }),
}));

let container;
let root;
let register;
beforeEach(() => {
  jest.resetAllMocks();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  register = jest.fn().mockResolvedValue(undefined);
  useAuth.mockReturnValue({ token: 'member-token', isLoggedIn: true, member: { displayName: 'Test' }, register });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const render = async element => act(async () => root.render(element));
const click = async element => act(async () => element.click());
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('wishlist retries failures and reloads when the token changes, ignoring stale responses', async () => {
  getWishlist.mockRejectedValueOnce(new Error('offline'));
  await render(<Wishlist />);
  expect(container.textContent).toContain('offline');
  getWishlist.mockResolvedValueOnce({ items: [{ id: 1, title: 'Saved movie' }] });
  await click(container.querySelector('button'));
  expect(container.textContent).toContain('successSaved movie');
  expect(getWishlist).toHaveBeenCalledWith('member-token');

  const oldRequest = deferred();
  getWishlist.mockReturnValueOnce(oldRequest.promise);
  await click(container.querySelector('button'));
  expect(container.textContent).toContain('loading');
  useAuth.mockReturnValue({ token: 'new-token', member: { displayName: 'New' } });
  getWishlist.mockResolvedValueOnce({ items: [{ id: 2, title: 'New member movie' }] });
  await render(<Wishlist />);
  await act(async () => oldRequest.resolve({ items: [{ id: 3, title: 'Old member movie' }] }));
  expect(getWishlist).toHaveBeenLastCalledWith('new-token');
  expect(container.textContent).toContain('New member movie');
  expect(container.textContent).not.toContain('Old member movie');
});

test('votes change only after success and retain the saved score after an API error', async () => {
  const request = deferred();
  putVote.mockReturnValueOnce(request.promise);
  await render(<MovieActions movieId={42} />);
  const buttons = container.querySelectorAll('button');
  await click(buttons[6]);
  expect(putVote).toHaveBeenCalledWith(42, 7, 'member-token');
  expect(buttons[6].className).not.toContain('bg-emerald-500');
  expect(buttons[6].disabled).toBe(true);
  await act(async () => request.resolve({}));
  expect(buttons[6].className).toContain('bg-emerald-500');
  putVote.mockRejectedValueOnce(new Error('vote failed'));
  await click(buttons[8]);
  expect(buttons[6].className).toContain('bg-emerald-500');
  expect(buttons[8].className).not.toContain('bg-emerald-500');
  expect(container.textContent).toContain('vote failed');
});

test('wishlist add and removal wait for success and preserve state on failures', async () => {
  await render(<MovieActions movieId={42} />);
  const heart = container.querySelectorAll('button')[10];
  addToWishlist.mockRejectedValueOnce(new Error('add failed'));
  await click(heart);
  expect(heart.textContent).toContain('🤍');
  const request = deferred();
  addToWishlist.mockReturnValueOnce(request.promise);
  await click(heart);
  expect(heart.disabled).toBe(true);
  expect(heart.textContent).toContain('🤍');
  await act(async () => request.resolve({}));
  expect(addToWishlist).toHaveBeenLastCalledWith(42, 'member-token');
  expect(heart.textContent).toContain('❤️');
  removeFromWishlist.mockRejectedValueOnce(new Error('remove failed'));
  await click(heart);
  expect(heart.textContent).toContain('❤️');
  expect(container.textContent).toContain('remove failed');
  removeFromWishlist.mockResolvedValueOnce(null);
  await click(heart);
  expect(removeFromWishlist).toHaveBeenLastCalledWith(42, 'member-token');
  expect(heart.textContent).toContain('🤍');
});

async function input(element, value) {
  await act(async () => {
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() {
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
test('registration blocks mismatched passwords and sends only the existing API arguments when corrected', async () => {
  await render(<Register />);
  const inputs = container.querySelectorAll('input');
  expect(inputs[3].required).toBe(true);
  await input(inputs[0], 'Test');
  await input(inputs[1], 'test@example.com');
  await input(inputs[2], 'secret');
  await input(inputs[3], 'different');
  await submit();
  expect(register).not.toHaveBeenCalled();
  expect(container.textContent).toContain('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
  expect(container.querySelector('button').disabled).toBe(false);
  await input(inputs[3], 'secret');
  await submit();
  expect(register).toHaveBeenCalledWith('test@example.com', 'secret', 'Test');
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('review submission calls the API, retains existing reviews, and shows errors without adding a review', async () => {
  getMovie.mockResolvedValue({ id: 42, title: 'Test movie' });
  getReviews.mockResolvedValue({ items: [{ id: 1, text: 'Existing review', member: { displayName: 'Reader' }, createdAt: '2026-10-07T00:00:00Z' }] });
  await render(<MovieDetail />);
  await input(container.querySelector('textarea'), 'My movie review');
  postReview.mockRejectedValueOnce(new Error('review failed'));
  await submit();
  expect(postReview).toHaveBeenCalledWith('42', 'My movie review', 'member-token');
  expect(container.textContent).toContain('review failed');
  expect(container.textContent).toContain('รีวิวจากสมาชิก (1)');
  expect(container.querySelector('textarea').value).toBe('My movie review');

  const request = deferred();
  postReview.mockReturnValueOnce(request.promise);
  await submit();
  expect(container.textContent).toContain('รีวิวจากสมาชิก (1)');
  expect(container.querySelector('textarea').disabled).toBe(true);
  await act(async () => request.resolve({ id: 2, text: 'My movie review', createdAt: '2026-10-07T01:00:00Z' }));
  expect(container.textContent).toContain('รีวิวจากสมาชิก (2)');
  expect(container.textContent).toContain('Existing review');
  expect(container.textContent).toContain('My movie review');
  expect(container.textContent).toContain('ขอบคุณสำหรับรีวิว');

  getReviews.mockResolvedValue({ items: [{ id: 2, text: 'My movie review', member: { displayName: 'Test' }, createdAt: '2026-10-07T01:00:00Z' }] });
  await render(<div />);
  await render(<MovieDetail />);
  expect(container.textContent).toContain('My movie review');
});
