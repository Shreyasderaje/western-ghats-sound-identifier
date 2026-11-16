"""Database initialisation script.

Creates all tables and inserts the Western Ghats species reference data
(20 birds + 10 frogs). Safe to run repeatedly — existing species rows are
updated, not duplicated.

Usage:  python seed_data.py
"""
from flask import Flask

import species_reference
from config import Config
from models import SpeciesReference, db


def seed_database(app):
    with app.app_context():
        db.create_all()
        updated = 0
        for row in species_reference.species_rows():
            existing = SpeciesReference.query.filter_by(
                species_name=row["species_name"]
            ).first()
            if existing:
                for key, value in row.items():
                    setattr(existing, key, value)
            else:
                db.session.add(SpeciesReference(**row))
            updated += 1
        db.session.commit()

        total = SpeciesReference.query.count()
        print(f"Seeded {updated} species rows; database now holds {total} species.")
        return total


if __name__ == "__main__":
    flask_app = Flask(__name__)
    flask_app.config.from_object(Config)
    db.init_app(flask_app)
    seed_database(flask_app)
