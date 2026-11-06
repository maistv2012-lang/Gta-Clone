# Executar Grand Theft Christchurch no Windows, fora do ChatGPT

Este roteiro usa a cópia completa do diretório de trabalho, com as alterações
atuais, todos os testes, Three.js local e os dados reais de Christchurch.
Não exige alterações no motor, compilação, WSL, Docker ou Bash para jogar.

## 1. Obter a cópia completa

Quando a branch `gta-christchurch` estiver enviada ao GitHub, instale Git for
Windows e copie o projeto no PowerShell:

```powershell
New-Item -ItemType Directory -Force C:\Jogos | Out-Null
cd C:\Jogos
git clone --branch gta-christchurch --single-branch https://github.com/maistv2012-lang/Gta-Clone.git Gta-Clone
```

Escolha outro diretório de destino se `C:\Jogos\Gta-Clone` já existir; preserve sua
cópia anterior. O `package.json` deve ficar em `C:\Jogos\Gta-Clone\package.json`.
Também pode selecionar essa branch no GitHub e usar **Code → Download ZIP**,
extrair e mover a pasta para esse caminho. Esses métodos exigem que a branch
já exista no GitHub: se o envio estiver bloqueado, o commit local não fica
acessível automaticamente pelo site. Não clone `main` esperando as alterações
antes de revisar e integrar o Pull Request.

A exportação ZIP feita anteriormente era uma cópia do diretório de trabalho,
com arquivos ainda não registrados no Git; seu link interno não é um download
público. Prefira o GitHub quando o envio da branch for confirmado.

## 2. Instalar e iniciar

Instale o **Node.js 24 LTS para Windows** em https://nodejs.org/ e o Google Chrome.
Feche e reabra o PowerShell após instalar. Execute:

```powershell
cd C:\Jogos\Gta-Clone
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run test:map:data
npm.cmd run test:map
npm.cmd run test:startup:unit
npm.cmd start
```

Usamos `npm.cmd` para evitar o bloqueio de `npm.ps1` pela política do PowerShell.
Não é necessário alterar essa política. A instalação e o primeiro `npm start`
precisam de internet para o npm. O comando start usa a versão fixa de
`http-server@14.1.1`, na porta 8080, sem cache HTTP.

Mantenha essa janela aberta. Abra **http://localhost:8080/** no Chrome do PC.
Espere a indicação de Christchurch pronto e clique **PLAY**. O menu deve sumir
somente após o primeiro quadro 3D validado. Não abra `index.html` por duplo clique
(`file://`). Não use `?map=legacy` para testar Christchurch.
Para encerrar o servidor use **Ctrl+C**; para iniciar de novo use `npm.cmd start`.
`localhost` aqui significa seu PC, não o ambiente remoto do Codex.

## 3. Confirmar o mapa incluído

Em outra janela PowerShell:

```powershell
cd C:\Jogos\Gta-Clone
(Get-Item .\data\christchurch.json).Length
(Get-FileHash .\data\christchurch.json -Algorithm SHA256).Hash
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/data/christchurch.json).StatusCode
```

O JSON incluído tem **6529104 bytes**. SHA-256:
`8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`.
As duas respostas HTTP devem ser **200**. `test:map:data` valida origem OSM,
Cathedral Square, Colombo Street, North/South Hagley Park, conexões e sentidos
legais de circulação pela esquerda.

O jogo lê esse JSON local; não faz requisições a Overpass durante a partida.
O ZIP também inclui `vendor/three/`, a licença e a atribuição OSM. Não é preciso
baixar o mapa novamente para jogar. Não substitua um arquivo ausente por um mapa
fictício; nesse caso, extraia novamente a cópia completa.

Atualização do mapa é opcional: `npm run map:fetch` usa Bash e curl, não é um
comando nativo do PowerShell. Caso queira atualizar, instale Git for Windows,
abra **Git Bash** na raiz do projeto e execute `npm run map:fetch`, depois
`npm run test:map:data`. Isso consulta os serviços OSM e altera o extrato local.
Não é necessário para este teste.

## 4. Se a página ainda falhar

- Confirme no terminal que o servidor iniciou e não exibiu `EADDRINUSE`.
  `Get-NetTCPConnection -LocalPort 8080 -State Listen` mostra o processo da porta.
  Não finalize processos desconhecidos. Se 8080 já estiver ocupada, pare seu
  servidor anterior ou inicie este projeto em outra porta:
  `npx.cmd -y http-server@14.1.1 -p 8081 -c-1 -s .` e abra
  **http://localhost:8081/**. A outra porta também cria uma origem nova para cache
  e service worker; um parâmetro de URL sozinho não faz isso.
- Para isolar cache antigo sem apagar partidas, use uma janela anônima do Chrome
  e abra a URL local. Fechar a janela anônima descarta os dados dessa sessão.
- Pressione **F12**, veja **Console** e **Network/Rede**, marque **Disable cache**
  e recarregue. Anote o primeiro erro e os pedidos com falha, especialmente
  `index.html`, `js/boot.js`, `js/main.js`, `vendor/three/three.module.js` e
  `data/christchurch.json`. HTTP 200 com HTML no lugar de JSON/JS é erro.
- Em **Application → Service Workers**, use **Bypass for network** temporariamente
  para verificar o cache do worker. Não use **Clear site data** se quiser
  preservar partidas/configurações já salvas nessa origem.
- Abra `chrome://gpu` e confira WebGL/WebGL2. Se estiverem desativados, confira
  a aceleração gráfica nas configurações de Sistema do Chrome e os drivers da GPU.
  Copie o erro exato antes de fazer alterações no jogo.

## 5. Testes de navegador no Windows (opcionais)

Com o servidor 8080 rodando e o Chrome instalado, em outro PowerShell:

```powershell
cd C:\Jogos\Gta-Clone
npm.cmd run test:startup
$env:GTC_REAL_MAP = '1'
node test/map-browser.mjs
Remove-Item Env:GTC_REAL_MAP
npm.cmd run test:preview
```

No PowerShell usamos a variável acima em vez do script `test:map:real`, cuja
sintaxe de variável é POSIX. Nenhum script existente foi removido ou reescrito.
Os testes usam o Chrome instalado (`channel: chrome`); se necessário indique
um executável existente com
`$env:GTC_BROWSER_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'`.
Não é necessário instalar outro navegador só para jogar.

## Acesso pelo telefone na mesma rede (opcional)

Primeiro confirme que funciona no PC. Com o servidor aberto, execute `ipconfig`
e procure o IPv4 da rede Wi-Fi/Ethernet ativa, por exemplo `192.168.1.20`.
No telefone conectado à mesma rede, abra `http://192.168.1.20:8080/`.
Permita o Node.js no Firewall do Windows apenas na rede privada, se solicitado.
Se a rede isolar os dispositivos, esse acesso pode falhar.

HTTP pelo IP da rede não é contexto seguro: service worker, fullscreen e outros
recursos opcionais podem ser restritos; o jogo deve mostrar o menu e usar o mapa
local. `localhost` no celular aponta para o celular, não para o PC.
Não configure redirecionamento de portas no roteador para este teste.

## Limites da verificação

A captura Companion do ChatGPT não disponibilizou endereço nem documento
(`page_id` e `document_view` nulos). Não há ferramenta de publicação/túnel/link
externo nesta sessão. A disponibilidade do servidor local e dos arquivos pode
ser verificada, mas isso não confirma a rota/proxy da Prévia autenticada.
Uma falha específica do ChatGPT não foi comprovada. O acesso direto local no PC
permite separar essa hipótese de problemas do Chrome, GPU ou inicialização.
A preparação foi validada em Linux/Chromium; o Windows físico não foi acessado.
