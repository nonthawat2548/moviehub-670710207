import { useEffect, useState } from 'react';
import MovieGrid from '../components/MovieGrid';
import { getMovies } from '../api/backend';
//import { forget } from '../api/cache';

function Movies() {
  const [query, setQuery] = useState('');          // คำค้น (controlled input) กรองในเครื่อง ไม่ยิง API
  const [genre, setGenre] = useState('all');       // แนวที่เลือกจากแถบปุ่ม 'all' = ทุกแนว

  const [movies, setMovies] = useState([]);        // รายการจาก getMovies() (โหลดจริงวันละครั้ง)
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);   // ตัวนับสำหรับปุ่ม "ลองใหม่"

  // โหลดตอน component เกิด และทุกครั้งที่กด "ลองใหม่" (reloadKey เปลี่ยน)
  useEffect(() => {
    let ignore = false;                            // ธงกันคำตอบเก่ามาทับคำตอบใหม่

    async function load() {
      setStatus('loading');
      try {
        const list = await getMovies();            // ครั้งแรกของวันยิง API ครั้งถัดไปอ่านจาก localStorage
        if (!ignore) {
          setMovies(list);
          setStatus('success');
        }
      } catch (err) {
        if (!ignore) {
          setError(err);
          setStatus('error');
        }
      }
    }
    load();

    return () => { ignore = true; };               // cleanup: effect รอบเก่าถูกยกเลิก
  }, [reloadKey]);

  // ค่าที่คำนวณจาก state ไม่ต้องเป็น state เอง: รายชื่อแนวที่มีจริง และรายการหลังกรอง
  const genres = [...new Set(movies.map(m => m.genre).filter(Boolean))];
  const q = query.trim().toLowerCase();
  const shown = movies.filter(m =>
    (genre === 'all' || m.genre === genre) &&
    (q === '' || m.title.toLowerCase().includes(q) || (m.titleTh ?? '').toLowerCase().includes(q))
  );

  const chipClass = (active) =>
    'rounded-full border px-3 py-1 text-sm transition ' +
    (active ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-200 bg-white text-slate-600 hover:bg-emerald-50');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">หนังทั้งหมด</h1>
          <p className="text-sm text-slate-500">
            แหล่งข้อมูล: TMDB (โหลดวันละครั้ง) {status === 'success' && `| พบ ${shown.length} จาก ${movies.length} เรื่อง`}
          </p>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์ชื่อหนังเพื่อกรอง..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 md:w-72" />
      </div>

      {/* เมนูเลือกแนวหนัง สร้างจากข้อมูลที่มีจริง ไม่ต้องพิมพ์รายชื่อเอง */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setGenre('all')} className={chipClass(genre === 'all')}>ทุกแนว</button>
        {genres.map(g => (
          <button key={g} onClick={() => setGenre(g)} className={chipClass(genre === g)}>{g}</button>
        ))}
      </div>

      {/* ปุ่มลองใหม่ต้องล้าง cache ก่อน ไม่งั้นจะได้ของเก่าหรือ error เดิมซ้ำ */}
      <MovieGrid movies={shown} status={status} error={error}
        onRetry={() => { setReloadKey(k => k + 1); }} />
    </div>
  );
}

export default Movies;