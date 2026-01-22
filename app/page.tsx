"use client";
import React, { useEffect, useState } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = { projectId: "tradingwebsite-484911" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// SOSTITUISCI CON LA TUA CHIAVE
const FINNHUB_TOKEN = ‘d5p59o1r01qs8sp44gf0d5p59o1r01qs8sp44gfga';

export default function TradingDashboard() {
  const [positions, setPositions] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // 1. Ascolta Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "positions"), (snapshot) => {
      const posData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPositions(posData);
      if (posData.length > 0 && !selectedSymbol) setSelectedSymbol(posData[0].symbol);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedSymbol]);

  // 2. Recupera Prezzi da Finnhub
  useEffect(() => {
    const fetchAllPrices = async () => {
      const updatedPrices = { ...livePrices };
      for (const pos of positions) {
        try {
          const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${pos.symbol}&token=${FINNHUB_TOKEN}`);
          const data = await response.json();
          if (data.c) {
            updatedPrices[pos.symbol] = data.c;
          }
        } catch (error) {
          console.error("Errore fetch prezzo per", pos.symbol, error);
        }
      }
      setLivePrices(updatedPrices);
    };

    if (positions.length > 0) {
      fetchAllPrices();
      // Aggiorna ogni 60 secondi
      const interval = setInterval(fetchAllPrices, 60000);
      return () => clearInterval(interval);
    }
  }, [positions]);

  const addAsset = async (e) => {
    e.preventDefault();
    if (!newSymbol || !newQty) return;
    await addDoc(collection(db, "positions"), {
      symbol: newSymbol.toUpperCase(),
      qty: parseFloat(newQty),
      entryPrice: parseFloat(newPrice) || 0
    });
    setNewSymbol(''); setNewQty(''); setNewPrice('');
  };

  const saveEdit = async (id) => {
    await updateDoc(doc(db, "positions", id), {
      qty: parseFloat(editQty),
      entryPrice: parseFloat(editPrice)
    });
    setEditingId(null);
  };

  // Calcolo Totale Portafoglio
  const totalValue = positions.reduce((acc, pos) => {
    const price = livePrices[pos.symbol] || pos.entryPrice || 0;
    return acc + (price * pos.qty);
  }, 0);

  return (
    <div className="min-h-screen bg-black text-white p-5 font-sans text-sm">
      <header className="border-b border-gray-800 pb-4 mb-5 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-500 tracking-tight">TRADING TERMINAL</h1>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">Live Portfolio Feed</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400 uppercase">Total Net Value</div>
          <div className="text-2xl font-mono font-bold text-green-400">
            ${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] gap-5">
        <div className="space-y-4">
          {/* Form Inserimento */}
          <form onSubmit={addAsset} className="bg-gray-900 p-4 rounded border border-gray-800 flex gap-2">
             <input placeholder="Ticker" value={newSymbol} onChange={e => setNewSymbol(e.target.value)} className="flex-1 bg-black border border-gray-700 p-2 rounded outline-none focus:border-blue-500" />
             <input type="number" placeholder="Qty" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-20 bg-black border border-gray-700 p-2 rounded" />
             <button className="bg-blue-600 px-4 rounded font-bold hover:bg-blue-700">+</button>
          </form>

          {/* Lista Assets */}
          <div className="bg-gray-900 rounded border border-gray-800">
            {positions.map((pos) => {
              const currentPrice = livePrices[pos.symbol] || 0;
              const delta = pos.entryPrice ? ((currentPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(2) : 0;
              const isPos = parseFloat(delta) >= 0;

              return (
                <div key={pos.id} className={`p-4 border-b border-gray-800 last:border-0 ${selectedSymbol === pos.symbol ? 'bg-gray-800' : ''}`}>
                  {editingId === pos.id ? (
                    <div className="space-y-2">
                       <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} className="w-full bg-black border p-1 rounded" />
                       <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-full bg-black border p-1 rounded" />
                       <button onClick={() => saveEdit(pos.id)} className="w-full bg-green-700 p-1 rounded text-[10px]">SAVE</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => setSelectedSymbol(pos.symbol)}>
                      <div className="flex-1">
                        <div className="font-bold text-lg leading-none">{pos.symbol}</div>
                        <div className={`text-[11px] font-bold mt-1 ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                          {isPos ? '▲' : '▼'} {delta}%
                        </div>
                      </div>
                      <div className="text-right mr-4">
                        <div className="font-mono text-base">${(currentPrice * pos.qty).toFixed(2)}</div>
                        <div className="text-[10px] text-gray-500 tracking-tighter">LIVE: ${currentPrice} | AVG: ${pos.entryPrice}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(pos.id); setEditQty(pos.qty); setEditPrice(pos.entryPrice); }} className="text-gray-600 hover:text-white">✎</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-gray-900 rounded border border-gray-800 h-[750px] overflow-hidden relative">
          <iframe key={selectedSymbol} src={`https://s.tradingview.com/widgetembed/?symbol=${selectedSymbol}&interval=D&theme=dark&style=1`} className="w-full h-full border-0"></iframe>
        </div>
      </div>
    </div>
  );
}
