build:
	NEXT_PUBLIC_VSS_JSON_PATH=/data/zod_vss.json NEXT_PUBLIC_MQTT_VIN=MDBAX9C12XYZ1234 VEHICLE_VINS=MDBAX9C12XYZ1234 docker compose up --build -d

start:
	NEXT_PUBLIC_VSS_JSON_PATH=/data/zod_vss.json NEXT_PUBLIC_MQTT_VIN=MDBAX9C12XYZ1234 VEHICLE_VINS=MDBAX9C12XYZ1234 docker compose up --build -d

start-truck:
	NEXT_PUBLIC_VSS_JSON_PATH=/data/truck1_trailer1_vss.json NEXT_PUBLIC_MQTT_VIN=1FABP34W72K012345 VEHICLE_VINS=1FABP34W72K012345 docker compose --profile truck up --build -d front mqtt-bridge vissr-truck1

start-local:
	MONGODB_URI="mongodb://mongodb:27017/vissr-integration?replicaSet=rs0" docker compose --profile local up -d

stop:
	docker compose --profile local stop

clean:
	docker compose --profile local down --rmi all -v
