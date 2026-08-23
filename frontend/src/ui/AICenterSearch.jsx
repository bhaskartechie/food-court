import React, { useRef, useState } from 'react';
import { Box, Paper, InputBase, IconButton, Avatar, Button, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import ImageIcon from '@mui/icons-material/Image';
import SearchIcon from '@mui/icons-material/Search';
import { aiAPI } from '../services/api';

function makeFormData({ text, file }) {
  const fd = new FormData();
  if (text) fd.append('query', text);
  if (file) fd.append('file', file, file.name);
  return fd;
}

export default function AICenterSearch() {
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const esRef = useRef(null);
  

  const handleSearch = async () => {
    const file = inputRef.current?.files?.[0];
    if (file) {
      // fallback: upload file and get immediate response (non-streaming)
      const fd = makeFormData({ text, file });
      try {
        const res = await aiAPI.multimodalSearch(fd);
        setResult(res.data);
      } catch (err) {
        setResult({ error: err.message || 'AI search failed' });
      }
      return;
    }

    // Use SSE streaming for text-only queries
    if (!text) {
      setResult({ error: 'Please enter a query or upload an image.' });
      return;
    }

    // Clean up previous EventSource if any
    if (esRef.current) {
      try { esRef.current.close(); } catch (_) {}
      esRef.current = null;
    }

    setResult(null);
    setStreaming(true);
    const url = `/api/v1/ai/stream?query=${encodeURIComponent(text)}`;
    const es = new EventSource(url);
    esRef.current = es;
    const partial = { ingredients: [], recipeText: '', final: null };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'skeleton') {
          setResult({ status: 'skeleton', message: data.message });
        } else if (data.type === 'ingredient') {
          partial.ingredients.push(data.ingredient);
          setResult({ status: 'partial', partial: { ...partial } });
        } else if (data.type === 'partial_recipe') {
          partial.recipeText += (data.text || '') + '\n';
          setResult({ status: 'partial', partial: { ...partial } });
        } else if (data.type === 'final') {
          partial.final = data;
          setResult({ status: 'final', final: data });
          setStreaming(false);
          es.close();
          esRef.current = null;
        }
      } catch (err) {
        // ignore parse errors
      }
    };

    es.onerror = (err) => {
      setStreaming(false);
      setResult({ error: 'Streaming connection error' });
      try { es.close(); } catch (_) {}
      esRef.current = null;
    };
  };

  return (
    <Box>
      <Paper elevation={3} sx={{ display: 'flex', alignItems: 'center', mx: 'auto', maxWidth: 960, px: 2, py: 1.2, borderRadius: 3, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
        <Avatar sx={{ bgcolor: '#25312a', mr: 1 }}>PP</Avatar>
        <InputBase value={text} onChange={(e) => setText(e.target.value)} sx={{ ml: 1, flex: 1, color: '#fff' }} placeholder="Describe your mood, type, or upload a fridge photo..." />
        <input type="file" ref={inputRef} style={{ display: 'none' }} id="ai-file" />
        <label htmlFor="ai-file">
          <IconButton component="span" sx={{ color: '#A3B18A' }}><ImageIcon /></IconButton>
        </label>
        <IconButton sx={{ color: '#FFD166' }}><MicIcon /></IconButton>
        <Button onClick={handleSearch} variant="contained" sx={{ bgcolor: '#FF6B35', ml: 1 }} startIcon={<SearchIcon />}>Search</Button>
      </Paper>
      {streaming && (
        <Paper sx={{ mt: 2, p: 2, maxWidth: 960, mx: 'auto' }} elevation={2}>
          <Typography variant="subtitle1">Streaming AI Result</Typography>
          <Box sx={{ mt: 1 }}>
            <div className="stream-skeleton" style={{ width: '60%', height: 14 }} />
          </Box>
        </Paper>
      )}

      {result && !streaming && (
        <Paper sx={{ mt: 2, p: 2, maxWidth: 960, mx: 'auto' }} elevation={2}>
          <Typography variant="subtitle1">AI Result</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );
}
