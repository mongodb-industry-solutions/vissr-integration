The files in this folder contains the truck and trailer trees.

I created both a YAML version and a binary version so that you can easily check what signals are available.

The two truck trees differ only on the default VIN value.

The two trailer trees differ on their default VIN value but also on their trailer type and axle/wheel layout.

## Running the truck1 demo

The legacy ZOD demo remains available through the existing `vissr` service.

To start the truck1/trailer1 demo, run:

```bash
make start-truck
```

This starts a dedicated `vissr-truck1` service that:

- loads `truck1.binary` as the `Vehicle` tree
- loads `trailer1.binary` as the `Trailer` tree
- keeps the standard `Types` and `Server` trees from the upstream VISSR image
- starts `vissv2server` with `-d` so tree defaults are written into memcache at startup
- feeds a small synthetic dataset from `infra/vissr/data/truck1_trailer1_feed.json`

The truck1 service uses these host ports:

- WebSocket: `9888`
- HTTP: `9090`
- AT server: `9600`
- gRPC: `9887`

The most important default values exposed by this setup are:

- `Vehicle.VehicleIdentification.VIN = 1FABP34W72K012345`
- `Trailer.TrailerIdentification.VIN = 3FABP34W72K234567`
- `Trailer.TrailerType = FULL_TRAILER`

The truck1-specific UDS registration includes `Vehicle` and `Trailer`, so both roots can be queried from the same VISSR instance.

## Notes

Here is some more information related to the trees.

If you start the viss server with the CLI parameter -d it leads to that the server at startup reads default values in tree and writes them into the statestorage.

As the trees contains different VINs, and the trailers different trailer type this could be of interest to read by the client.

The new temperature and brake signals is found in the Wheel.vspec file. This file is identical for the truck tree and the trailer tree.

Below is an example of the signals resulting from the Wheel vspec.

```
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.AngularSpeed",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.FluidLevel",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.IsBrakesWorn",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.IsFluidLevelLow",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.IsTemperatureHigh",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.PadWear",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.Temperature",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Speed",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire.IsPowerSufficient",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire.IsPressureLow",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire.IsTemperatureHigh",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire.Pressure",
"Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire.Temperature"
```
