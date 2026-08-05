import re

filepath = r'c:\CY\client\screens\ProfileScreen.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Count replacement characters
replacement_char = '\ufffd'
count_before = content.count(replacement_char)
print(f'Caracteres corruptos () antes: {count_before}')

# All replacements: (corrupted pattern, correct text)
# Patterns are plain strings, not regex, for simple .replace()
replacements = [
    # -- contraseña --
    ('contrasea', 'contraseña'),
    ('contraseas', 'contraseñas'),
    # -- teléfono --
    ('telfono', 'teléfono'),
    ('Telfono', 'Teléfono'),
    # -- número --
    ('nmero', 'número'),
    ('Nmero', 'Número'),
    # -- cédula --
    ('cdula', 'cédula'),
    ('Cdula', 'Cédula'),
    # -- mínimo --
    ('mnimo', 'mínimo'),
    ('Mnimo', 'Mínimo'),
    # -- más (cuidado: no tocar "demás", "además" si los hay) --
    # Solo reemplazar "ms" como palabra independiente
    # -- vehículo --
    ('vehculo', 'vehículo'),
    ('vehculos', 'vehículos'),
    ('Vehculo', 'Vehículo'),
    # -- matrícula --
    ('matrcula', 'matrícula'),
    # -- español/España --
    ('espaol', 'español'),
    ('Espaa', 'España'),
    ('Espaol', 'Español'),
    # -- dueño --
    ('Dueo', 'Dueño'),
    ('dueo', 'dueño'),
    # -- profesión --
    ('profesin', 'profesión'),
    # -- aplicación --
    ('aplicacin', 'aplicación'),
    ('aplicacines', 'aplicaciones'),
    # -- conexión --
    ('conexin', 'conexión'),
    ('conexines', 'conexiones'),
    # -- verificación --
    ('verificacin', 'verificación'),
    # -- información --
    ('informacin', 'información'),
    # -- configuración --
    ('configuracin', 'configuración'),
    # -- notificación --
    ('notificacin', 'notificación'),
    ('notificacines', 'notificaciones'),
    # -- suscripción --
    ('suscripcin', 'suscripción'),
    # -- cancelación --
    ('cancelacin', 'cancelación'),
    ('cancelacines', 'cancelaciones'),
    # -- atención --
    ('atencin', 'atención'),
    # -- función --
    ('funcin', 'función'),
    ('funcines', 'funciones'),
    # -- opción --
    ('opcin', 'opción'),
    # -- revisión --
    ('revisin', 'revisión'),
    # -- suspensión --
    ('suspensin', 'suspensión'),
    # -- identificación --
    ('identificacin', 'identificación'),
    # -- actualización --
    ('actualizacin', 'actualización'),
    # -- expiración --
    ('expiracin', 'expiración'),
    # -- aceptación --
    ('aceptacin', 'aceptación'),
    # -- preparación --
    ('preparacin', 'preparación'),
    # -- obligación --
    ('obligacin', 'obligación'),
    # -- eliminación --
    ('eliminacin', 'eliminación'),
    # -- reclamación --
    ('reclamacin', 'reclamación'),
    # -- retención --
    ('retencin', 'retención'),
    # -- ubicación --
    ('ubicacin', 'ubicación'),
    # -- autorización --
    ('autorizacin', 'autorización'),
    # -- penalización --
    ('penalizacin', 'penalización'),
    # -- prximamente --
    ('prximamente', 'próximamente'),
    # -- galera --
    ('galera', 'galería'),
    # -- est/ests --
    ('est', 'está'),
    ('ests', 'estás'),
    # -- ms (más) --
    ('ms ', 'más '),
    (' ms', ' más'),
    # --  (¿) --
    ('', '¿'),
    # -- sesin --
    ('sesin', 'sesión'),
    # -- calificacin --
    # -- proteccin --
    ('proteccin', 'protección'),
    # -- direccin --
    ('direccin', 'dirección'),
    ('direccines', 'direcciones'),
    # -- descripcin --
    ('descripcin', 'descripción'),
    # -- comprensin --
    # -- clasificacin --
    # -- licencia/permiso
    ('conducir', 'conducir'),  # no-op placeholder
]

# Apply replacements
total = 0
for old, new in replacements:
    c = content.count(old)
    if c > 0:
        content = content.replace(old, new)
        total += c
        print(f'  {c}x: "{old}" -> "{new}"')

print(f'\nTotal reemplazos: {total}')

# Also fix: "prximo" patterns (próximo, próximos)
# And "ms" standalone (más)
# And "galera" (galería)

# Generic pattern: replace any remaining  with best guess
# But first count remaining
count_after = content.count(replacement_char)
print(f'Caracteres corruptos restantes: {count_after}')

if count_after > 0:
    # Find which unique patterns remain
    remaining_patterns = set()
    for i, ch in enumerate(content):
        if ch == replacement_char:
            start = max(0, i-5)
            end = min(len(content), i+5)
            remaining_patterns.add(content[start:end])
    print('\nPatrones restantes:')
    for p in sorted(remaining_patterns)[:20]:
        print(f'  {repr(p)}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('\nArchivo guardado.')