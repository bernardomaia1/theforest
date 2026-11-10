# The Forest — site

Site estático (HTML, CSS e JavaScript puros). Não precisa de build.

## Testar localmente
Abra um servidor na pasta (os modelos 3D carregam imagens e não funcionam abrindo o arquivo direto com duplo clique):

```bash
npx serve .
```
ou
```bash
python3 -m http.server 8000
```
Depois acesse http://localhost:8000 (ou a porta indicada).

## Publicar
Funciona em GitHub Pages, Netlify ou Vercel apontando para esta pasta (arquivo inicial: `index.html`).

## Arquivos
- `index.html` — página, estilos e scripts da interface
- `journey.js` — viagem 3D da abertura (Three.js)
- `map3d.js` — mapa 3D girável do evento
- `liquid.js` — fundo líquido verde granulado (WebGL)
- `f1.jpg`–`f6.jpg` e `g/` — fotos do evento
- `logo.png`, `wolf_t.png`, `word_t.png`, `word_o.png`, `mapa.png` — logo e texturas

Bibliotecas externas: Three.js r128 (cdnjs e jsDelivr) e fontes do Google Fonts.

## Pendências
- Link de venda de ingressos (hoje os botões levam à seção de ingressos)
