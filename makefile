PROFILE ?= zod
DB ?= local
NUM_VEHICLES ?= 1

GENERATED_DIR := .generated
RUNTIME_ENV_FILE := $(GENERATED_DIR)/runtime.env
TRUCK_COMPOSE_FILE := $(GENERATED_DIR)/docker-compose.trucks.generated.yml
GENERATOR := node scripts/generate-runtime-config.mjs

COMPOSE_FILES := -f docker-compose.yml -f $(TRUCK_COMPOSE_FILE)

ifeq ($(DB),local)
COMPOSE_FILES += -f docker-compose.local.yml
endif

ALL_COMPOSE_FILES := -f docker-compose.yml -f $(TRUCK_COMPOSE_FILE) -f docker-compose.local.yml

.PHONY: prepare build up start restart stop clean

prepare:
	@mkdir -p $(GENERATED_DIR)
	@$(GENERATOR) --profile $(PROFILE) --num-vehicles $(NUM_VEHICLES) --output-compose-file $(TRUCK_COMPOSE_FILE) --output-env-file $(RUNTIME_ENV_FILE)

build: prepare
	@set -a; . $(RUNTIME_ENV_FILE); set +a; docker compose $(COMPOSE_FILES) build

up: start

start: prepare
	@set -a; . $(RUNTIME_ENV_FILE); set +a; docker compose $(COMPOSE_FILES) up --build -d --remove-orphans

restart:
	@$(MAKE) stop PROFILE=$(PROFILE) DB=$(DB) NUM_VEHICLES=$(NUM_VEHICLES)
	@$(MAKE) start PROFILE=$(PROFILE) DB=$(DB) NUM_VEHICLES=$(NUM_VEHICLES)

stop: prepare
	@set -a; . $(RUNTIME_ENV_FILE); set +a; docker compose $(ALL_COMPOSE_FILES) stop

clean: prepare
	@set -a; . $(RUNTIME_ENV_FILE); set +a; docker compose $(ALL_COMPOSE_FILES) down --rmi all -v --remove-orphans
