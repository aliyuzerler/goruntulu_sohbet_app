// sync_i18n.dart — regenerates lib/i18n/tr.dart and en.dart from
// the human-edited JSON files. Run after editing tr.json or en.json.
//
//   dart run scripts/sync_i18n.dart
//
// Phase 7 may switch to slang + codegen; until then this is enough.

import 'dart:convert' show json;
import 'dart:io';

const Map<String, String> inputs = {
  'lib/i18n/tr.json': 'lib/i18n/tr.dart',
  'lib/i18n/en.json': 'lib/i18n/en.dart',
};

void main() {
  final root = Directory('.').path;
  inputs.forEach((inPath, outPath) {
    final src = File('$root/$inPath').readAsStringSync();
    final decoded = json.decode(src);
    final buf = StringBuffer()
      ..writeln('// AUTO-GENERATED from ${inPath.split('/').last} — DO NOT EDIT by hand.')
      ..writeln('// Source: $inPath — re-run scripts/sync_i18n.dart if you change the JSON.')
      ..writeln('const Map<String, dynamic> ${inPath.contains('tr') ? 'tr' : 'en'} = ${_toDartLiteral(decoded)};')
      ..writeln();
    File('$root/$outPath').writeAsStringSync(buf.toString());
    print('✓ $inPath → $outPath');
  });
}

String _toDartLiteral(Object? node) {
  if (node is String) {
    // Use raw string for placeholders like ${seconds}
    if (node.contains('\${')) {
      return "r'''$node'''";
    }
    return _escapeString(node);
  }
  if (node is num || node is bool || node == null) {
    return node.toString();
  }
  if (node is List) {
    final items = node.map(_toDartLiteral).join(', ');
    return '[$items]';
  }
  if (node is Map) {
    final entries = node.entries.map(
      (e) => '${_escapeString(e.key.toString())}: ${_toDartLiteral(e.value)}',
    );
    return '{${entries.join(', ')}}';
  }
  throw StateError('Unsupported JSON node type: ${node.runtimeType}');
}

String _escapeString(String s) {
  // Use double quotes; escape backslash, quote, newline.
  final escaped = s.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
  return '"$escaped"';
}
