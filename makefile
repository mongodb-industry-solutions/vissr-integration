PROFILE ?= zod
DB ?= local

ifeq ($(PROFILE),truck)
DEFAULT_VSS_JSON_PATH := /data/truck1_trailer1_vss.json
DEFAULT_MQTT_VIN := 1FABP34W72K012345
else
DEFAULT_VSS_JSON_PATH := /data/zod_vss.json
DEFAULT_MQTT_VIN := MDBAX9C12XYZ1234
endif

VSS_JSON_PATH ?= $(DEFAULT_VSS_JSON_PATH)
MQTT_VIN ?= $(DEFAULT_MQTT_VIN)
VEHICLE_VINS ?= $(MQTT_VIN)

COMPOSE_FILES := -f docker-compose.yml
ALL_COMPOSE_FILES := -f docker-compose.yml -f docker-compose.local.yml
COMPOSE_PROFILES :=
ALL_COMPOSE_PROFILES := --profile truck

ifeq ($(DB),local)
COMPOSE_FILES += -f docker-compose.local.yml
endif

ifeq ($(PROFILE),truck)
COMPOSE_PROFILES += --profile truck
endif

COMPOSE_ENV = VSS_JSON_PATH=$(VSS_JSON_PATH) MQTT_VIN=$(MQTT_VIN) VEHICLE_VINS=$(VEHICLE_VINS)

.PHONY: build up start restart stop clean

build:
	$(COMPOSE_ENV) docker compose $(COMPOSE_FILES) $(COMPOSE_PROFILES) build

up: start

start:
	$(COMPOSE_ENV) docker compose $(COMPOSE_FILES) $(COMPOSE_PROFILES) up --build -d

restart:
	docker compose $(ALL_COMPOSE_FILES) $(ALL_COMPOSE_PROFILES) down --remove-orphans
	$(MAKE) start PROFILE=$(PROFILE) DB=$(DB) VSS_JSON_PATH=$(VSS_JSON_PATH) MQTT_VIN=$(MQTT_VIN) VEHICLE_VINS=$(VEHICLE_VINS)

stop:
	docker compose $(ALL_COMPOSE_FILES) $(ALL_COMPOSE_PROFILES) stop

clean:
	docker compose $(ALL_COMPOSE_FILES) $(ALL_COMPOSE_PROFILES) down --rmi all -v
