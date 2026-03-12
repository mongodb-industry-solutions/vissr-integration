build:
	docker compose up --build -d

start: 
	docker compose up -d

start-local:
	MONGODB_URI="mongodb://mongodb:27017/vissr-integration?replicaSet=rs0" docker compose --profile local up -d

stop:
	docker compose --profile local stop

clean:
	docker compose --profile local down --rmi all -v
