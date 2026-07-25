import os
import re

files_info = [
    ('backend/properties.py', 'Property', 'PropertyCreate', 'prop', 'property_id'),
    ('backend/owners.py', 'Owner', 'OwnerCreate', 'owner', 'owner_id'),
    ('backend/tenants.py', 'Tenant', 'TenantCreate', 'tenant', 'tenant_id'),
    ('backend/transactions.py', 'Transaction', 'TransactionCreate', 'transaction', 'transaction_id'),
]

for filepath, model_name, schema_name, obj_var, id_var in files_info:
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Fix GET ALL
    old_get = f"db.query(models.{model_name}).offset(skip).limit(limit).all()"
    new_get = f"db.query(models.{model_name}).filter(models.{model_name}.agency_id == current_user.agency_id).offset(skip).limit(limit).all()"
    content = content.replace(old_get, new_get)
    
    # Fix POST
    old_post_add = f"db_{obj_var} = models.{model_name}(**{obj_var}.model_dump())"
    new_post_add = f"""{obj_var}_data = {obj_var}.model_dump()
    {obj_var}_data['agency_id'] = current_user.agency_id
    db_{obj_var} = models.{model_name}(**{obj_var}_data)"""
    content = content.replace(old_post_add, new_post_add)
    
    # Fix PUT filter
    old_put_filter = f"db.query(models.{model_name}).filter(models.{model_name}.id == {id_var}).first()"
    new_put_filter = f"db.query(models.{model_name}).filter(models.{model_name}.id == {id_var}, models.{model_name}.agency_id == current_user.agency_id).first()"
    content = content.replace(old_put_filter, new_put_filter)
    
    # We don't want to replace the first `db_xxx = ...first()` in POST because that checks if id exists globally or locally.
    # Actually, the above replace hits POST, PUT and DELETE because they all do `.filter(models.X.id == id_var).first()`. This is exactly what we want, except in POST where we want to ensure the ID is globally unique or locally unique. The naive replace changes all of them, which is perfect (a tenant ID shouldn't be duplicated in the same agency, or at all if it's a UUID).
    # Wait, in POST, the id_var is usually `{obj_var}.id`. Let's check `properties.py`. It is `models.Property.id == prop.id`.
    # Let's manually replace the ones we want.
    
    # More precise PUT/DELETE replacement:
    # Instead of replacing all `.filter(models.X.id == ...).first()`, let's just write a regex or safer string replace.
    pass

def apply_precise_patch(filepath, model_name, obj_var, id_var):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    out = []
    in_post = False
    in_put = False
    
    for line in lines:
        if line.strip().startswith('@router.post'):
            in_post = True
        elif line.strip().startswith('@router.put'):
            in_post = False
            in_put = True
        elif line.strip().startswith('@router.delete'):
            in_post = False
            in_put = False
            
        # GET ALL
        if f"db.query(models.{model_name}).offset" in line:
            line = line.replace(f"db.query(models.{model_name})", f"db.query(models.{model_name}).filter(models.{model_name}.agency_id == current_user.agency_id)")
            
        # POST instantiation
        if in_post and f"models.{model_name}(**{obj_var}.model_dump())" in line:
            indent = line[:len(line) - len(line.lstrip())]
            line = f"{indent}{obj_var}_data = {obj_var}.model_dump()\n{indent}{obj_var}_data['agency_id'] = current_user.agency_id\n{indent}db_{obj_var} = models.{model_name}(**{obj_var}_data)\n"
            
        # PUT / DELETE filter
        if (not in_post) and f"filter(models.{model_name}.id == {id_var})" in line:
            line = line.replace(f"filter(models.{model_name}.id == {id_var})", f"filter(models.{model_name}.id == {id_var}, models.{model_name}.agency_id == current_user.agency_id)")
            
        # PUT getattr
        if in_put and f"setattr(db_{obj_var}, key, value)" in line:
            indent = line[:len(line) - len(line.lstrip())]
            line = f"{indent}if key != 'agency_id':\n{indent}    setattr(db_{obj_var}, key, value)\n"

        out.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(out)
        print(f"Patched {filepath}")

for filepath, model_name, schema_name, obj_var, id_var in files_info:
    if os.path.exists(filepath):
        apply_precise_patch(filepath, model_name, obj_var, id_var)
