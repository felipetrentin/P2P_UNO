import asyncio
import websockets
import json
import logging

# Configuração de log para ver o que está acontecendo
logging.basicConfig(level=logging.INFO)

# Conjunto para rastrear todas as conexões ativas
# Um 'set' (conjunto) garante que cada conexão seja única
CONNECTED_CLIENTS = set()


# é criado um handler para cada conexão do websocket
async def handler(websocket):
    """
    Manipula a conexão e as mensagens de um único cliente.
    """
    # Adiciona a nova conexão ao conjunto de clientes
    CONNECTED_CLIENTS.add(websocket)
    logging.info(f"Cliente conectado: {websocket.remote_address}. Total: {len(CONNECTED_CLIENTS)}")

    try:
        # Loop principal para escutar mensagens do cliente
        async for message in websocket:
            logging.info(f"Mensagem recebida de {websocket.remote_address}")
            # Converte a mensagem JSON de volta para string para retransmissão
            # No WebRTC, a mensagem é o objeto SDP ou ICE Candidate
            
            # Retransmite a mensagem para todos os outros clientes
            await broadcast(websocket, message)

    except websockets.ConnectionClosed as e:
        logging.warning(f"Conexão fechada: {websocket.remote_address}. Código: {e.code}, Razão: {e.reason}")
    finally:
        # Remove a conexão quando ela é fechada (ou ocorre um erro)
        CONNECTED_CLIENTS.remove(websocket)
        logging.info(f"Cliente desconectado. Total restante: {len(CONNECTED_CLIENTS)}")

async def broadcast(sender_websocket, message):
    """
    Envia a mensagem recebida para todos os clientes, exceto o remetente.
    """
    if CONNECTED_CLIENTS:
        # Cria uma lista de tarefas de envio para cada cliente ativo
        tasks = [
            client.send(message)
            for client in CONNECTED_CLIENTS
            if client != sender_websocket  # Não retransmite para o remetente
        ]
        # Executa todas as tarefas de envio simultaneamente
        await asyncio.gather(*tasks)
        logging.info(f"Mensagem retransmitida para {len(tasks)} clientes.")

async def main():
    """
    Função principal para iniciar o servidor WebSocket.
    """
    # Inicia o servidor em localhost (127.0.0.1) na porta 8080
    # O handler(websocket) será chamado para cada nova conexão
    async with websockets.serve(handler, "0.0.0.0", 8080):
        logging.info("Servidor de Sinalização WebRTC (Python) rodando em ws://localhost:8080")
        # Mantém o servidor rodando infinitamente
        await asyncio.Future() 

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServidor parado pelo usuário.")