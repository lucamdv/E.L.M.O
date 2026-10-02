# ELMO v8 — relatório de validação visual

Data: 2026-10-01

Escopo encerrado neste marco: reconstrução visual do `ElmoOrbWebGL`, Face v1, presença, estados, emoções, gaze, parallax interno e comparação com o fallback SVG. Nenhuma integração externa foi adicionada.

## Resultado

O Orb anterior tinha leitura achatada porque a maior parte da informação óptica estava concentrada no plano frontal: a casca tinha pouca espessura aparente, as estruturas internas compartilhavam movimento e profundidade muito próximos e os highlights não descreviam suficientemente o perfil esférico.

A reconstrução usa uma esfera orgânica completa, câmera com FOV 32, membrana Fresnel deformável, casca física com transmissão/espessura, duas massas internas em profundidades diferentes, três dobras ópticas e luz interna difusa. O rosto é geometria 3D posicionada dentro do volume; uma membrana externa ainda passa visualmente sobre ele. O resultado preserva a silhueta cheia do protótipo v7 e recupera volume, densidade e personalidade.

## Uso do protótipo v7

O arquivo `elmo-prototipo-3d-v7-emocoes-unificadas.html` foi aberto, executado e comparado visualmente com o Luca OS. Foram transportados o DNA do personagem — proporção, presença, Face v1 sem boca, oito emoções, blink irregular e separação entre emoção/estado/olhar — sem copiar a técnica de CanvasTexture nem o shader original.

## Arquitetura óptica

- `Outer shell`: `meshPhysicalMaterial` com transmission, thickness, IOR, roughness, clearcoat e iluminação ambiental.
- `Outer membrane`: shader pequeno para deformação orgânica, Fresnel, face safe zone e aberração cromática periférica sutil.
- `Inner matter`: duas massas orgânicas irregulares com densidades, escalas, rotações e planos distintos.
- `Internal structures`: três dobras volumétricas suspensas dentro da massa.
- `Face`: olhos elipsoidais e sobrancelhas volumétricas dentro do volume; nenhuma boca.
- `Inner light`: luz difusa sem emissor central visível.
- `Environment light`: tokens Morning/Afternoon/Golden/Night iluminam o mesmo material; não há quatro skins.

## Face, parallax e safe zone

- Emoções oficiais: `neutral`, `happy`, `curious`, `focused`, `surprised`, `sleepy`, `excited`, `concerned`.
- Blink: intervalo irregular de 3–7 s, double blink raro e ritmo específico para sleepy/focused/listening.
- Parallax: casca, massas, estruturas e rosto usam amplitudes e velocidades diferentes.
- Gaze: `neutral`, `user`, `content` e `anticipate`; conteúdo nasce 270 ms depois do início de `anticipate`.
- Face Safe Zone: o shader reduz highlights frontais fortes na região central sem esvaziar a matéria interna.

## Estados operacionais

Os seis estados preservam a separação `rosto = emoção`, `corpo = estado`, `olhar = atenção`, `luz = horário`:

- `IDLE`: tensão estável e vida interna lenta.
- `LISTENING`: alongamento/atenção e matéria mais orientada.
- `THINKING`: circulação interna mais complexa, sem spinner.
- `TOOL_EXECUTION`: tensão e deslocamento para a direção do conteúdo.
- `SPEAKING`: envelope de voz simulado deforma a própria matéria.
- `ERROR`: contração, redução de energia e coerência, sem depender de vermelho.

## Matriz visual capturada

| Artefato | Horário / estado / expressão |
|---|---|
| `08-morning-neutral-idle-desktop.png` | 08:00 · IDLE · neutral |
| `08-morning-excited-speaking-desktop.png` | 08:00 · SPEAKING · excited |
| `14-afternoon-focused-listening-desktop.png` | 14:00 · LISTENING · focused |
| `14-afternoon-curious-thinking-desktop.png` | 14:00 · THINKING · curious |
| `18-golden-happy-speaking-desktop.png` | 18:00 · SPEAKING · happy |
| `18-golden-surprised-listening-desktop.png` | 18:00 · LISTENING · surprised |
| `22-night-sleepy-idle-desktop.png` | 22:00 · IDLE · sleepy |
| `22-night-concerned-error-desktop.png` | 22:00 · ERROR · concerned |
| `18-golden-populated-desktop.png` | 1280×720 · Spatial UI ativa |
| `18-golden-populated-tablet.png` | 834×1194 · Spatial UI ativa |
| `18-golden-populated-mobile.png` | 390×844 · Spatial UI ativa |

Tablet confirmou `scrollWidth = innerWidth = 834`. Mobile confirmou `scrollWidth = innerWidth = 390`; sem overflow horizontal.

## Performance observada

- GPU do navegador interativo: NVIDIA GeForce GTX 1660 SUPER via ANGLE/D3D11.
- 72 FPS (limite de amostragem do navegador), 13,9 ms/frame.
- 11 draw calls.
- 23.376 triângulos.
- DPR 1.
- Inicialização observada: 1,1–1,2 s.
- Chunks relacionados ao Orb/Three no build: 162.044 B + 959.547 B = 1.121.591 B sem compressão; carregamento WebGL continua lazy.
- Nenhuma dependência foi adicionada nesta fase. Foram reutilizados `three`, `@react-three/fiber` e `@react-three/drei` já presentes.

O navegador não expõe medição estável de porcentagem de CPU/GPU; foram usados frame time, FPS, draw calls, triângulos, DPR, tempo de inicialização e identificação do renderer.

## Validação funcional e acessível

- `npm run lint`: aprovado.
- `npm run build`: aprovado; rota `/` prerenderizada.
- Console do navegador: nenhum erro na execução final.
- SVG fallback: aprovado.
- Troca SVG ↔ WebGL: aprovada; desmontagem intencional do Canvas não é mais confundida com perda real de contexto.
- Reduced motion: aprovado; microdeformação/circulação reduzidas.
- Reduced transparency: aprovado; transmissão reduzida sem virar círculo opaco.
- Teclado/foco: tabulação do input para o microfone confirmada.
- Interrupção: `SPEAKING` → `LISTENING` confirmada em aproximadamente 120 ms, sem aguardar animação.
- Foreground adaptativo e scene graph: preservados sem regressão contratual.

## Arquivos centrais

- `src/components/elmo/elmo-orb-webgl.tsx`
- `src/components/elmo/elmo-orb-settings.ts`
- `src/components/elmo/elmo-orb-renderer.tsx`
- `src/components/elmo/elmo-orb-webgl.module.css`
- `src/components/luca-os-experience.tsx`
- `scripts/capture-responsive.mjs`

## Limitações conhecidas

- O envelope de voz ainda é simulado; a interface de parâmetros está pronta para amplitude real futura.
- A refração sobre o rosto é uma composição raster controlada pela membrana externa, não ray tracing multi-pass.
- Caustics explícitas foram evitadas: o ganho visual não justificou custo e ruído sobre a Face Safe Zone.
- Percentuais absolutos de uso de CPU/GPU dependem de ferramentas externas e não foram tratados como métrica portátil do produto.
- O resultado continua sendo POC visual; nenhuma integração Realtime, Gmail, Calendar ou Weather foi iniciada.
