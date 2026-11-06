# Verificação da exportação

- Na inspeção inicial, a porta 8080 não tinha listener e retornava ECONNREFUSED.
- O servidor existente foi iniciado com `npm start`, sem alterar o comando.
  Listener confirmado em `0.0.0.0:8080`.
- HTML, bootstrap, renderização, main, service worker e JSON OSM responderam 200,
  com bytes idênticos aos arquivos atuais e cabeçalho HTTP no-store.
- O endereço autenticado da Prévia não foi fornecido (Companion nulo).
  Não foi possível comprovar falha no proxy do ChatGPT ou gerar link público.
- O ZIP contém o estado atual, incluindo arquivos ainda não registrados no Git.
  `.git`, `node_modules` e diretórios de ferramentas/credenciais não são incluídos.
  Nenhum arquivo original foi excluído.
- Uma primeira cópia ZIP foi verificada por CRC e comparação SHA-256 de cada
  arquivo com a origem, extraída em diretório temporário e instalada com `npm ci`.
- Nessa cópia: validação OSM aprovada, 10 testes do grafo e 7 testes de carregamento
  aprovados. Os dados mantêm o SHA-256 registrado em WINDOWS.md.
- Servidor idêntico ao comando de start, com porta 8082 para evitar colisão,
  serviu a cópia extraída. Chromium desktop e móvel, diretamente, sem iframe,
  mostraram menu e cenário 3D após PLAY, com OSM carregado. Sem pageerrors,
  requisições com falha ou status HTTP >=400. Console/rede e PNGs estão aqui.
- Essas imagens foram inspecionadas; o teste não se baseou apenas no estado play.
- Teste realizado em Linux/Chromium/SwiftShader. Não é confirmação em Windows
  físico ou no Galaxy do usuário. Demais suítes de regressão não foram repetidas;
  o código de produção e os testes existentes não foram modificados nesta etapa.
- O ZIP final inclui também esta documentação e as evidências da primeira cópia.
- Nenhum deploy/publicação foi realizado. O servidor 8080 foi deixado ativo;
  substituir o ambiente ou encerrar processos pode interrompê-lo novamente.
