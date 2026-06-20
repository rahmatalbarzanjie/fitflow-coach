/**
 * Instrumentasi sementara untuk audit performance (console.time/timeEnd).
 * Bukan untuk production - dipakai untuk benchmark, hapus setelah selesai diukur.
 */

export async function timed<T>(label: string, promise: PromiseLike<T>): Promise<T> {
  console.time(label)
  try {
    return await promise
  } finally {
    console.timeEnd(label)
  }
}
