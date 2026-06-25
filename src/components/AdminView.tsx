import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronLeft, Plus, Edit2, Trash2, Save, X, Settings, RefreshCw, Volume2, BookOpen, ShoppingBag } from 'lucide-react';
import devocionaisJson from '../data/devocionais.json';

export function AdminView({
  onGoHome,
  hideBackButton = false,
}: {
  onGoHome?: () => void;
  hideBackButton?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'products' | 'devotionals'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [devotionals, setDevotionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDevIndex, setEditingDevIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    desc: '',
    price: '',
    image: '',
    tag: '',
    checkoutUrl: '',
    pdfUrl: ''
  });

  const [devAudioUrl, setDevAudioUrl] = useState('');

  // 1. Escutar Produtos
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProds = onSnapshot(q, (snapshot) => {
      const prods: any[] = [];
      snapshot.forEach(d => prods.push({ id: d.id, ...d.data() }));
      setProducts(prods);
      if (activeTab === 'products') setLoading(false);
    });

    return () => unsubscribeProds();
  }, [activeTab]);

  // 2. Escutar/Carregar Devocionais do banco para mesclar áudios
  useEffect(() => {
    if (activeTab !== 'devotionals') return;
    setLoading(true);

    const unsubscribeDevs = onSnapshot(collection(db, 'devotionals'), (snapshot) => {
      const dbAudios: Record<string, string> = {};
      snapshot.forEach(doc => {
        dbAudios[doc.id] = doc.data().audioUrl || '';
      });

      // Mapear os devocionais do JSON local, injetando as URLs do Firestore correspondentes
      const mapped = devocionaisJson.map((d: any, idx: number) => {
        const idStr = String(idx + 1);
        return {
          id: idx + 1,
          dia: d.dia,
          tema: d.tema,
          frase: d.frase,
          audioUrl: dbAudios[idStr] || ''
        };
      });

      setDevotionals(mapped);
      setLoading(false);
    });

    return () => unsubscribeDevs();
  }, [activeTab]);

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '',
      desc: p.desc || '',
      price: p.price || '',
      image: p.image || '',
      tag: p.tag || '',
      checkoutUrl: p.checkoutUrl || '',
      pdfUrl: p.pdfUrl || ''
    });
  };

  const handleEditDev = (dev: any, index: number) => {
    setEditingDevIndex(index);
    setDevAudioUrl(dev.audioUrl || '');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingDevIndex(null);
    setErrorMsg(null);
    setFormData({ name: '', desc: '', price: '', image: '', tag: '', checkoutUrl: '', pdfUrl: '' });
  };

  const processImageUrl = (url: string) => {
    if (!url) return url;
    let cleanUrl = url.trim();
    if (cleanUrl.includes('ibb.co/') && !cleanUrl.includes('i.ibb.co')) {
      const id = cleanUrl.split('ibb.co/')[1]?.replace('/', '');
      if (id) {
        return `https://i.ibb.co/${id}/image.png`;
      }
    }
    return cleanUrl;
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!formData.name || !formData.price || !formData.image) {
      setErrorMsg("Preencha ao menos Nome, Preço e URL da Imagem");
      return;
    }

    let finalImage = formData.image.trim();
    if (finalImage.includes('ibb.co/') && !finalImage.includes('i.ibb.co')) {
      try {
        const res = await fetch("/api/admin/process-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: finalImage })
        });
        const data = await res.json();
        if (data.directUrl) {
          finalImage = data.directUrl;
        }
      } catch (err) {
        console.error("Error converting image link:", err);
      }
    }

    try {
      if (editingId === 'new') {
        await addDoc(collection(db, 'products'), {
          ...formData,
          image: finalImage,
          createdAt: serverTimestamp()
        });
      } else if (editingId) {
        await updateDoc(doc(db, 'products', editingId), {
          ...formData,
          image: finalImage
        });
      }
      handleCancel();
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Erro ao salvar produto: " + (e.message || "Erro desconhecido"));
    }
  };

  const handleSaveDevAudio = async () => {
    if (editingDevIndex === null) return;
    setErrorMsg(null);

    const dev = devotionals[editingDevIndex];
    const docId = String(dev.id);

    try {
      // Salva ou atualiza a URL do áudio no Firestore para o ID do devocional correspondente
      await setDoc(doc(db, 'devotionals', docId), {
        audioUrl: devAudioUrl.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      handleCancel();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao salvar áudio do devocional: " + (err.message || ""));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (e: any) {
        console.error(e);
        setErrorMsg("Erro ao excluir produto: " + (e.message || ""));
      }
    }
  };

  const loadDefaultProducts = async () => {
    if (confirm("Deseja inserir os 4 produtos originais no banco de dados agora?")) {
      const defaults = [
        { tag: "Essencial", name: "Bíblia de Estudo", desc: "Capa em couro PU", price: "R$ 120,00", image: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&q=80&w=400&h=400" },
        { tag: "Mais Vendido", name: "Camiseta 'Missio Dei'", desc: "Algodão premium 100%", price: "R$ 69,90", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400&h=400" },
        { tag: "", name: "Caneca Propósito", desc: "Cerâmica 320ml", price: "R$ 45,00", image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=400&h=400" }
      ];
      
      for (const item of defaults) {
        await addDoc(collection(db, 'products'), {
          ...item,
          createdAt: serverTimestamp()
        });
      }
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="mb-4">
        {!hideBackButton && onGoHome && (
          <button onClick={onGoHome} className="text-[#FF5A00] flex items-center gap-1 mb-4 text-[13px] font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={16} /> Voltar
          </button>
        )}
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <Settings className="text-[#FF5A00]" /> Painel Admin
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">Gerencie os produtos e áudios do aplicativo.</p>
      </div>

      {/* Menu de Abas */}
      <div className="flex bg-[#111] p-1 rounded-xl mb-6 border border-white/5">
        <button
          onClick={() => { setActiveTab('products'); setEditingId(null); setEditingDevIndex(null); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'products' ? 'bg-[#FF5A00] text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShoppingBag size={14} /> Produtos da Loja
        </button>
        <button
          onClick={() => { setActiveTab('devotionals'); setEditingId(null); setEditingDevIndex(null); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'devotionals' ? 'bg-[#FF5A00] text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Volume2 size={14} /> Áudios dos Devocionais
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="w-6 h-6 text-[#FF5A00] animate-spin" />
        </div>
      ) : activeTab === 'products' ? (
        // --- ABA DE PRODUTOS ---
        !editingId ? (
          <div className="space-y-4">
            <div className="flex gap-2 mb-6">
              <button 
                onClick={() => {
                  setEditingId('new');
                  setFormData({ name: '', desc: '', price: '', image: '', tag: '', checkoutUrl: '', pdfUrl: '' });
                }}
                className="flex-1 bg-[#FF5A00]/10 text-[#FF5A00] font-sans font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 hover:bg-[#FF5A00]/20 border border-[#FF5A00]/20"
              >
                <Plus size={18} /> Novo Produto
              </button>
              <button 
                onClick={loadDefaultProducts}
                className="bg-white/5 text-gray-400 font-sans font-bold px-4 rounded-2xl transition-colors flex flex-col items-center justify-center hover:bg-white/10 border border-white/10"
                title="Restaurar produtos padrão de exemplo"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {products.length === 0 && (
              <p className="text-gray-500 text-center py-10">Nenhum produto cadastrado no banco.</p>
            )}

            {products.map(p => (
              <div key={p.id} className="bg-[#1A1A1A] rounded-xl p-4 border border-white/5 flex gap-4 items-center">
                <img src={p.image} className="w-16 h-16 object-cover rounded-lg bg-[#111]" alt={p.name} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold truncate text-sm">{p.name}</h3>
                  <p className="text-[#FF5A00] text-xs font-bold">{p.price}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleEdit(p)} className="p-2 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-500/10 rounded-lg text-red-500 hover:bg-red-500/20 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-white/5 space-y-4">
            <h3 className="text-white font-bold mb-4">{editingId === 'new' ? 'Novo Produto' : 'Editar Produto'}</h3>
            {errorMsg && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm font-bold">{errorMsg}</div>}
            
            <div>
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">Nome do Produto *</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" placeholder="Ex: Camiseta EMT" />
            </div>
            <div>
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">Descrição</label>
              <input value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" placeholder="Ex: 100% algodão" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">Preço *</label>
                <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" placeholder="Ex: R$ 69,90" />
              </div>
              <div className="flex-1">
                <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">Tag</label>
                <input value={formData.tag} onChange={e => setFormData({...formData, tag: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" placeholder="Ex: Novidade" />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">URL da Imagem *</label>
              <input value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">Link de Pagamento (Opcional)</label>
              <input value={formData.checkoutUrl} onChange={e => setFormData({...formData, checkoutUrl: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">Link do Arquivo Digital (PDF / E-book)</label>
              <input value={formData.pdfUrl} onChange={e => setFormData({...formData, pdfUrl: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" />
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button onClick={handleCancel} className="flex-1 bg-white/5 text-white font-bold py-3.5 rounded-xl transition-colors hover:bg-white/10 flex items-center justify-center gap-2"><X size={16} /> Cancelar</button>
              <button onClick={handleSave} className="flex-1 bg-[#FF5A00] text-white font-bold py-3.5 rounded-xl transition-colors hover:bg-[#E04D00] flex items-center justify-center gap-2"><Save size={16} /> Salvar</button>
            </div>
          </div>
        )
      ) : (
        // --- ABA DE DEVOCIONAIS (UPLOAD ÁUDIO MP3 HÍBRIDO) ---
        editingDevIndex === null ? (
          <div className="space-y-4">
            <p className="text-zinc-500 text-[11px] bg-white/5 p-4 rounded-xl leading-relaxed">
              Aqui você pode gerenciar a gravação em áudio de cada um dos devocionais. Cole o link direto do arquivo MP3 (do Firebase Storage ou outro servidor). Caso não configure áudio, o aplicativo usará a voz de IA sintética automaticamente.
            </p>

            {devotionals.map((dev, idx) => (
              <div key={dev.id} className="bg-[#1A1A1A] rounded-xl p-4 border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 bg-primary-orange/10 text-primary-orange font-bold text-xs rounded-full flex items-center justify-center shrink-0">
                  Dia {dev.dia}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold truncate text-sm">{dev.tema}</h3>
                  <p className="text-[10px] text-zinc-500 truncate">{dev.frase}</p>
                  <p className={`text-[10px] font-bold mt-1 uppercase ${dev.audioUrl ? 'text-[#00D1A0]' : 'text-yellow-600'}`}>
                    {dev.audioUrl ? '✓ Áudio Gravado Ativo' : '⚠ Sem áudio (Fallback IA ativo)'}
                  </p>
                </div>
                <button 
                  onClick={() => handleEditDev(dev, idx)}
                  className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                    dev.audioUrl ? 'bg-[#00D1A0]/10 text-[#00D1A0] hover:bg-[#00D1A0]/20' : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-white/5 space-y-4">
            <h3 className="text-white font-bold mb-1 font-serif text-lg">Configurar Áudio do Dia {devotionals[editingDevIndex].dia}</h3>
            <p className="text-zinc-500 text-xs mb-4">Insira o link do áudio MP3 gravado para o devocional: <strong>"{devotionals[editingDevIndex].tema}"</strong></p>

            {errorMsg && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm font-bold">{errorMsg}</div>}

            <div>
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">URL do arquivo MP3 (Google Drive, Firebase, etc.)</label>
              <input 
                value={devAudioUrl} 
                onChange={e => setDevAudioUrl(e.target.value)} 
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none" 
                placeholder="https://suahospedagem.com/audios/dia_X.mp3"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
              <button onClick={handleCancel} className="flex-1 bg-white/5 text-white font-bold py-3.5 rounded-xl transition-colors hover:bg-white/10 flex items-center justify-center gap-2"><X size={16} /> Cancelar</button>
              <button onClick={handleSaveDevAudio} className="flex-1 bg-[#FF5A00] text-white font-bold py-3.5 rounded-xl transition-colors hover:bg-[#E04D00] flex items-center justify-center gap-2"><Save size={16} /> Salvar Áudio</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
