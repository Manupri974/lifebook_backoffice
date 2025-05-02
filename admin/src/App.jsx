import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export default function App() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const nowISO = new Date().toISOString();
      const minus24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const minus72h = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
      const minus1w = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [
        { count: totalLivres },
        { count: todayLivres },
        last,
        types,
        queueCounts,
        { count: totalQueue },
        responsesAll,
        previews,
        livres
      ] = await Promise.all([
        supabase.from("livres_generes").select("*", { count: "exact", head: true }),
        supabase.from("livres_generes").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("livres_generes").select("created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("livres_generes").select("type").then(({ data }) => {
          const counts = data.reduce((acc, row) => {
            acc[row.type] = (acc[row.type] || 0) + 1;
            return acc;
          }, {});
          return counts;
        }),
        Promise.all(
          Array.from({ length: 10 }, (_, i) => i + 1).map(async (h) => {
            const date = new Date(Date.now() - h * 3600 * 1000).toISOString();
            const { count } = await supabase
              .from("generation_queue")
              .select("*", { count: "exact", head: true })
              .eq("status", "pending")
              .lte("created_at", date);
            return { [`+${h}h`]: count };
          })
        ).then(async (arr) => {
          const combined = Object.assign({}, ...arr);
          const { count: lessThan1h } = await supabase
            .from("generation_queue")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending")
            .gt("created_at", new Date(Date.now() - 3600 * 1000).toISOString());
          return { "<1h": lessThan1h, ...combined };
        }),
        supabase.from("generation_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("responses").select("id, created_at, params"),
        supabase.from("preview").select("interview_id"),
        supabase.from("livres_generes").select("interview_id")
      ]);

      const previewSet = new Set(previews.data.map(p => p.interview_id));
      const livreSet = new Set(livres.data.map(l => l.interview_id));

      const group = {};
      responsesAll.data.forEach(row => {
        const params = row.params || {};
        const clef = [params.type, params.vue, params.enfants, params.format].filter(Boolean).join(" | ");

        if (!group[clef]) {
          group[clef] = {
            total: 0,
            avecPreview: 0,
            avecLivre: 0,
            enCours: 0
          };
        }

        group[clef].total++;

        if (livreSet.has(row.id)) {
          group[clef].avecLivre++;
        } else if (previewSet.has(row.id)) {
          group[clef].avecPreview++;
        } else {
          group[clef].enCours++;
        }
      });

      setStats({
        totalLivres,
        todayLivres,
        totalUsers: "—",
        dernierLivre: last.data?.[0]?.created_at,
        types,
        queue: queueCounts,
        totalQueue,
        interviews: group
      });
    }

    fetchStats();
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4 space-y-4">
        <h1 className="text-xl font-bold">📘 LifeBook Admin</h1>
        <nav className="space-y-2">
          <a href="#" className="block hover:text-purple-300">Dashboard</a>
          <a href="#" className="block hover:text-purple-300">Utilisateurs</a>
          <a href="#" className="block hover:text-purple-300">File d'attente</a>
          <a href="#" className="block hover:text-purple-300">API & Logs</a>
        </nav>
      </aside>

      <main className="flex-1 bg-gray-50 p-6">
        <h2 className="text-2xl font-semibold mb-6">📊 Statistiques générales</h2>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-4 rounded shadow">📘 Total livres : <strong>{stats.totalLivres}</strong></div>
            <div className="bg-white p-4 rounded shadow">👥 Utilisateurs : <strong>{stats.totalUsers}</strong></div>
            <div className="bg-white p-4 rounded shadow">📅 Aujourd’hui : <strong>{stats.todayLivres}</strong></div>
            <div className="bg-white p-4 rounded shadow">🕒 Dernier livre : <strong>{new Date(stats.dernierLivre).toLocaleString()}</strong></div>
            <div className="bg-white p-4 rounded shadow">
              📚 Répartition types :
              <ul className="mt-2 text-sm">
                {Object.entries(stats.types).map(([k, v]) => (
                  <li key={k}>{k} : {v}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-4 rounded shadow">
              ⏱️ File d’attente totale : <strong>{stats.totalQueue}</strong>
              <ul className="mt-2 text-sm">
                {Object.entries(stats.queue).map(([h, c]) => (
                  <li key={h}>{h} : {c}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-4 rounded shadow col-span-full">
              🗂️ Interviews par configuration :
              <table className="w-full mt-2 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1">Config</th>
                    <th className="text-left px-2 py-1">Total</th>
                    <th className="text-left px-2 py-1">En cours</th>
                    <th className="text-left px-2 py-1">Avec preview</th>
                    <th className="text-left px-2 py-1">Livre généré</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.interviews).map(([config, data]) => (
                    <tr key={config} className="border-b">
                      <td className="px-2 py-1 font-semibold">{config}</td>
                      <td className="px-2 py-1">{data.total}</td>
                      <td className="px-2 py-1">{data.enCours}</td>
                      <td className="px-2 py-1">{data.avecPreview}</td>
                      <td className="px-2 py-1">{data.avecLivre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
