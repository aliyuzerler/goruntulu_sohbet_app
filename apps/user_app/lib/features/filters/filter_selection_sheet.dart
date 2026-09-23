/// Filter selection sheet — Phase 7.
/// Shows gender (VIP paywall if not VIP) and country (coin paywall) selectors.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:country_picker/country_picker.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/vip_filter_dto.dart';
import '../../i18n/strings.dart';

class FilterSelectionSheet extends ConsumerStatefulWidget {
  const FilterSelectionSheet({super.key});

  @override
  ConsumerState<FilterSelectionSheet> createState() => _FilterSelectionSheetState();
}

class _FilterSelectionSheetState extends ConsumerState<FilterSelectionSheet> {
  ActiveFiltersDto? _active;
  bool _loading = true;
  bool _activating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final a = await ApiClient.getActiveFilters();
      setState(() {
        _active = a;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _onGenderTap() {
    if (_active?.genderAllowed != true) {
      // Paywall — gender filter requires VIP.
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(t.vipPaywallTitle),
          content: Text(t.filtersGenderPaywallBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(t.filtersCancel),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/vip');
              },
              child: Text(t.vipGoVip),
            ),
          ],
        ),
      );
      return;
    }
    // VIP user — show gender chips (selected genders are sent via queue:join).
    // Phase 7 simple: show a "VIP active" message.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('VIP active — gender filter applied via match button')),
    );
  }

  void _onCountryTap() async {
    final cost = 20; // Phase 7 — fetched from server in Phase 8.
    if (_active?.vipActive == true) {
      // VIP user — country filter is free.
      _showCountryPicker(isVip: true, cost: cost);
      return;
    }
    // Non-VIP — paywall for coin cost.
    final choice = await showDialog<_CountryPaywallChoice>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(t.filtersCountryTitle),
        content: Text(t.filtersCountryPaywallBody(cost)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, _CountryPaywallChoice.cancel),
            child: Text(t.filtersCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, _CountryPaywallChoice.activate),
            child: Text(t.filtersCountryActivate(cost)),
          ),
          OutlinedButton(
            onPressed: () => Navigator.pop(context, _CountryPaywallChoice.goVip),
            child: Text(t.vipGoVip),
          ),
        ],
      ),
    );
    if (choice == _CountryPaywallChoice.activate) {
      _showCountryPicker(isVip: false, cost: cost);
    } else if (choice == _CountryPaywallChoice.goVip) {
      if (mounted) context.push('/vip');
    }
  }

  void _showCountryPicker({required bool isVip, required int cost}) {
    showCountryPicker(
      context: context,
      showPhoneCode: false,
      onSelect: (country) => _activateCountry(country.countryCode, isVip: isVip),
    );
  }

  Future<void> _activateCountry(String countryCode, {required bool isVip}) async {
    setState(() => _activating = true);
    try {
      final res = await ApiClient.activateCountryFilter(countryCode: countryCode);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.filtersActivated)),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.filtersActivateFailed(e.toString()))),
      );
    } finally {
      if (mounted) setState(() => _activating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return DraggableScrollableSheet(
      initialChildSize: 0.45,
      minChildSize: 0.3,
      maxChildSize: 0.7,
      expand: false,
      builder: (context, scrollController) => Container(
        color: const Color(0xFF0B0B0B),
        child: ListView(
          controller: scrollController,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                i18n.filtersTitle,
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.person_search, color: Colors.white70),
              title: Text(i18n.filtersGenderTitle, style: const TextStyle(color: Colors.white)),
              subtitle: Text(
                _active?.genderAllowed == true
                    ? '${i18n.vipActive} — seçili'
                    : i18n.filtersAny,
                style: TextStyle(
                  color: _active?.genderAllowed == true
                      ? const Color(0xFFFFCC00)
                      : Colors.white38,
                  fontSize: 12,
                ),
              ),
              trailing: _active?.genderAllowed == true
                  ? const Icon(Icons.check_circle, color: Color(0xFF34C759))
                  : const Icon(Icons.lock, color: Colors.white38),
              onTap: _onGenderTap,
            ),
            ListTile(
              leading: const Icon(Icons.public, color: Colors.white70),
              title: Text(i18n.filtersCountryTitle, style: const TextStyle(color: Colors.white)),
              subtitle: Text(
                _active?.country != null
                    ? t.filtersCountryActive(_active!.country!)
                    : i18n.filtersAny,
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
              trailing: _activating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.chevron_right, color: Colors.white54),
              onTap: _activating ? null : _onCountryTap,
            ),
          ],
        ),
      ),
    );
  }
}

enum _CountryPaywallChoice { cancel, activate, goVip }
