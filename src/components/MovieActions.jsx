import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { putVote, addToWishlist, removeFromWishlist } from '../api/backend';

// แถบปุ่มใต้ชื่อหนัง: ให้คะแนน 1 ถึง 10 และปุ่มเพิ่มเข้า wishlist (ต้อง login)
function MovieActions({ movieId }) {
  const { isLoggedIn, token } = useAuth();
  const [myScore, setMyScore] = useState(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [message, setMessage] = useState(null);
  const [isSavingVote, setIsSavingVote] = useState(false);
  const [isSavingWishlist, setIsSavingWishlist] = useState(false);

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        <Link to="/login" className="text-emerald-600 hover:underline">เข้าสู่ระบบ</Link> เพื่อให้คะแนนและเพิ่มเข้ารายการที่อยากดู
      </p>
    );
  }

  async function handleVote(score) {
    if (isSavingVote) return;
    setIsSavingVote(true);
    setMessage(null);
    try {
      await putVote(movieId, score, token);
      setMyScore(score);
      setMessage('บันทึกคะแนนแล้ว');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsSavingVote(false);
    }
  }

  async function handleWishlist() {
    if (isSavingWishlist) return;
    setIsSavingWishlist(true);
    setMessage(null);
    try {
      if (inWishlist) {
        await removeFromWishlist(movieId, token);
      } else {
        await addToWishlist(movieId, token);
      }
      setInWishlist(!inWishlist);
      setMessage(inWishlist ? 'นำออกจากรายการที่อยากดูแล้ว' : 'เพิ่มเข้ารายการที่อยากดูแล้ว');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsSavingWishlist(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-2 text-sm text-slate-500">ให้คะแนน</span>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => handleVote(n)} disabled={isSavingVote}
                  className={'h-8 w-8 rounded-lg border text-sm ' +
                    (myScore === n ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-200 bg-white text-slate-600 hover:bg-emerald-50')}>
            {n}
          </button>
        ))}
      </div>
      <button onClick={handleWishlist} disabled={isSavingWishlist}
              className={'rounded-lg border px-4 py-2 text-sm ' +
                (inWishlist ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-emerald-200 bg-white text-slate-600 hover:bg-emerald-50')}>
        {inWishlist ? '❤️ อยู่ในรายการที่อยากดูแล้ว' : '🤍 เพิ่มเข้ารายการที่อยากดู'}
      </button>
      {message && <p className="text-sm text-slate-500">{message}</p>}
    </div>
  );
}

export default MovieActions;
