This directory is the single home for VISSR runtime assets that vary per vehicle.

## Layout

- `index.json`: inventory used by the generated runtime config
- `default/`: default zod-only runtime assets
- `truck1/`, `truck2/`: one folder per simulated truck server
- `shared/`: shared source artifacts referenced by the vehicle definitions

Each truck folder contains:

- `viss.him`: the vehicle/trailer tree mapping used by VISSR
- `uds-registration.json`: roots exposed by that vehicle server
- `feed.json`: synthetic feeder input for that server
- `tree/vehicle.yaml` and `tree/trailer.yaml`: human-readable tree sources
- `tree/vehicle.binary` and `tree/trailer.binary`: runtime tree artifacts copied into the image

The default zod server uses the shared upstream tree setup and the feed file in `../data/`, but its local UDS registration now lives in `default/uds-registration.json` so all UDS registration files are co-located here.

## Notes

The two truck vehicle trees mainly differ by default VIN values. The trailer trees also differ in trailer type and axle layout.

The shared wheel signal source lives in `shared/Wheel.vspec`. It documents the extra wheel, tire, and brake signals included by the truck/trailer trees.
