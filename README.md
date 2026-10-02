# Luca OS / Elmo

Implementação greenfield do assistente pessoal **Elmo**, que vive dentro do **Luca OS**.

## Marco atual

O marco atual implementa a fundação visual e interativa e a POC do Orb 2.0:

- Adaptive Ambient UI contínua, usando `America/Recife`.
- Orb do Elmo em SVG/CSS, preservado como padrão e fallback.
- `ElmoOrbWebGL` isolado e carregado sob demanda, com membrana refrativa,
  massas internas, iluminação ambiental e os seis estados operacionais.
- Foregrounds semânticos e interpolados para tipografia, informações e controles.
- Scene graph controlado para Weather, Calendar e Gmail.
- Conversational Spatial UI responsiva.
- Nascimento de conteúdo, mudança de protagonismo e interrupção.
- Reduced motion, reduced transparency e navegação por teclado.

Os dados e cenários atuais são locais e fictícios. OpenAI Realtime, Calendar, Gmail e Weather reais ainda não estão conectados.

## Desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O painel **Laboratório** permite testar horários, estados e cenas sem serviços externos.

Nenhuma credencial é necessária neste marco.

## POC Orb 2.0

Dependências adicionadas:

- `three@0.180.0`
- `@react-three/fiber@9.8.1`
- `@react-three/drei@10.7.9`

O Canvas pertence somente ao Elmo. A UI, as capabilities, o scene graph e o
composer continuam em DOM/React. O WebGL usa DPR 1, duas amostras de
transmission e cerca de 14,4 mil triângulos / 7 draw calls na cena populada.

O chunk WebGL é lazy e mede aproximadamente 944 KiB sem compressão / 259 KiB
com gzip no build deste marco. A inicialização observada no navegador de teste
ficou entre 0,6 e 2,5 s. O navegador automatizado limita `requestAnimationFrame`
mesmo com o Canvas desmontado; por isso, leituras de FPS abaixo de 10 são
marcadas no laboratório como amostra limitada e precisam ser confirmadas em
uma aba ativa e hardware real antes de promover WebGL a renderer principal.
