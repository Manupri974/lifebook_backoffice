import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export default function App() {
  const [livres, setLivres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLivres() {
      const { data } = await supabase.from("livres_generes").select("*").order("created_at", { ascending: false });
      setLivres(data || []);
      setLoading(false);
    }
    fetchLivres();
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
        <h2 className="text-2xl font-semibold mb-4">📚 Livres générés</h2>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <table className="w-full table-auto bg-white shadow rounded">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2">Utilisateur</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Lien</th>
              </tr>
            </thead>
            <tbody>
              {livres.map((livre) => (
                <tr key={livre.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{livre.user_id}</td>
                  <td className="px-4 py-2">{livre.type}</td>
                  <td className="px-4 py-2">{new Date(livre.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <a href={livre.url} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
                      Voir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}