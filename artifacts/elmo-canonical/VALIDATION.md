# ELMO canônico — validação visual e técnica

## Resultado

O `ElmoOrbWebGL` foi reconstruído como uma porta direta do pipeline Three.js do protótipo v7. O Luca OS preserva suas paletas ambientais; silhueta, câmera, face, expressões, matéria interna, micro movimento, blink e gaze derivam do protótipo canônico.

## Diferença em relação à POC anterior

A POC anterior distribuía a identidade entre várias camadas translúcidas e iluminação homogênea. Isso reduzia contraste interno e cues laterais, produzindo uma leitura de lente/bolha achatada. A nova implementação usa a esfera 96×96, o shader procedural, a câmera de 40° e a calota facial CanvasTexture do protótipo como uma única composição coordenada.

## Integração ambiental

- A identidade-base continua azul óptica profunda.
- `uLt` recebe a iluminação ambiental interpolada.
- `uDay` adapta a composição óptica sobre fundos claros sem recolorir o personagem.
- Morning recebe luz quente; Afternoon, luz diurna fria; Golden Hour, incidência champagne; Night, profundidade azul.
- A Face Safe Zone reduz highlights fortes sobre olhos e sobrancelhas.

## Comportamento

- Estados: IDLE, LISTENING, THINKING, TOOL_EXECUTION, SPEAKING e ERROR.
- Emoções: neutral, happy, curious, focused, surprised, sleepy, excited e concerned.
- Face, corpo, gaze e iluminação permanecem independentes.
- Blink irregular e micro movimento não usam loop curto identificável.
- SPEAKING aceita hoje envelope simulado; a mesma variável pode receber amplitude real no futuro.
- SVG continua disponível como fallback e comparação de laboratório.

## Performance observada

- 2 draw calls.
- 22.848 triângulos.
- DPR limitado a 1.5.
- 69 FPS / 14,5 ms na amostra ativa de validação (o valor varia com throttling da aba).
- Inicialização observada: 82 ms.
- Chunk lazy do ELMO/Three: 498.189 bytes bruto; 125.058 bytes gzip.

## Verificações

- `npm run lint`: aprovado.
- `npm run build`: aprovado; TypeScript e geração estática concluídos.
- Console em aba nova: sem erros ou warnings.
- SVG fallback: validado sem Canvas WebGL.
- Reduced Motion e Reduced Transparency: validados pelo laboratório.
- Foco por teclado: input → controle de microfone.
- Sem overflow horizontal em 390×844, 834×1194 e 1280×720.

## Limitações conhecidas

- A fala ainda usa envelope simulado; OpenAI Realtime não foi conectado.
- O protótipo original inclui campo de partículas e luz de chão próprios. Eles não foram copiados porque o ambiente aprovado do Luca OS continua sendo a fonte de iluminação e composição externa.
- Drag/zoom do arquivo exploratório não foi promovido à experiência principal; o cursor-follow continua restrito ao laboratório.
- Métricas de FPS dependem de a aba estar ativa e podem cair artificialmente por throttling do navegador.

## Dependências

- Mantida: `three@0.180.0`.
- Adicionada para type-check: `@types/three@0.180.0`.
- Removidas por não serem necessárias após a porta direta: `@react-three/fiber` e `@react-three/drei`.

