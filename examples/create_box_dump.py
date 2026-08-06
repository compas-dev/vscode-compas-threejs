from pathlib import Path

from compas.geometry import Box
from compas_pb import pb_dump
from compas_pb import __version__ as compas_pb_version


output = Path(__file__).with_name("box.compas.pb")
if compas_pb_version.split(".", 1)[0] != "1":
    raise RuntimeError(
        "This viewer targets the COMPAS-Protobuf 1.x wire format; "
        f"the active compas_pb version is {compas_pb_version}."
    )
pb_dump(Box(2, 3, 1), output.as_posix())
print(f"Wrote {output}")
